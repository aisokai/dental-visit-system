# 変更ログ機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 患者個人情報の更新時にサーバータイムスタンプ・変更者・旧値→新値を Firestore サブコレクションに追記し、患者一覧の履歴ボタンから最新5件を閲覧できるようにする。

**Architecture:** `patients/{id}/changelog` サブコレクションに追記専用で保存（改竄不可）。変更者名は各変更操作のタイミングで入力。ユーティリティ関数 `changelogUtils.js` に純粋関数（差分計算）と Firestore 操作を集約する。

**Tech Stack:** React 19, Firebase Firestore (`addDoc` + `serverTimestamp`), date-fns (`format`), lucide-react (`History`, `X`)

---

## ファイル構成

```
新規作成:
  src/utils/changelogUtils.js          # FIELD_LABELS / computeFormDiff / addChangelogEntry / getLatestChangelog
  src/tests/changelogUtils.test.js     # computeFormDiff のユニットテスト
  src/components/ChangelogModal.jsx    # 最新5件表示モーダル

既存変更:
  src/components/datacheck/InlineEditCell.jsx   # staffName 入力欄追加・onSave(value, staffName) に変更
  src/components/datacheck/MonthlyPrepCheck.jsx # handleSave に changelog 書き込み追加
  src/components/datacheck/QualityCheck.jsx     # handleSave に changelog 書き込み追加
  src/components/StatusChangeDialog.jsx         # staffName フィールド追加
  src/pages/Patients.jsx                        # handleStatusConfirm に changelog 追加・履歴ボタン追加
  src/pages/PatientForm.jsx                     # staffName フィールド追加・originalForm 保持・changelog 書き込み
```

---

## Task 1: changelogUtils.js — ユーティリティ関数 + テスト

**Files:**
- Create: `src/utils/changelogUtils.js`
- Create: `src/tests/changelogUtils.test.js`

- [ ] **Step 1: テストを書く**

```js
// src/tests/changelogUtils.test.js
import { describe, it, expect } from 'vitest'
import { computeFormDiff, FIELD_LABELS } from '../utils/changelogUtils'

describe('FIELD_LABELS', () => {
  it('主要フィールドのラベルが定義されている', () => {
    expect(FIELD_LABELS.name).toBe('氏名')
    expect(FIELD_LABELS.insuranceExpiryDate).toBe('介護保険期限')
    expect(FIELD_LABELS.status).toBe('ステータス')
    expect(FIELD_LABELS.careManagerFax).toBe('ケアマネFAX')
  })
})

describe('computeFormDiff', () => {
  const base = {
    name: '田中太郎',
    insuranceExpiryDate: '2025-04',
    careLevel: '要介護3',
    status: 'active',
    phone: '',
  }

  it('変更なしの場合は空配列を返す', () => {
    expect(computeFormDiff(base, { ...base })).toHaveLength(0)
  })

  it('変更されたフィールドのみ返す', () => {
    const updated = { ...base, insuranceExpiryDate: '2026-04', careLevel: '要介護4' }
    const diff = computeFormDiff(base, updated)
    expect(diff).toHaveLength(2)
    const expiry = diff.find(d => d.field === 'insuranceExpiryDate')
    expect(expiry.oldValue).toBe('2025-04')
    expect(expiry.newValue).toBe('2026-04')
    expect(expiry.label).toBe('介護保険期限')
  })

  it('FIELD_LABELS に含まれないフィールドは無視する', () => {
    const updated = { ...base, unknownField: 'foo', createdAt: 'bar' }
    expect(computeFormDiff(base, updated)).toHaveLength(0)
  })

  it('null と空文字は同じ扱い（差分なし）', () => {
    const original = { ...base, phone: null }
    const updated = { ...base, phone: '' }
    expect(computeFormDiff(original, updated)).toHaveLength(0)
  })

  it('boolean フィールドの変更を検出する', () => {
    const updated = { ...base, isFacility: true }
    const diff = computeFormDiff({ ...base, isFacility: false }, updated)
    expect(diff).toHaveLength(1)
    expect(diff[0].field).toBe('isFacility')
    expect(diff[0].oldValue).toBe('false')
    expect(diff[0].newValue).toBe('true')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm run test:run -- src/tests/changelogUtils.test.js
```

Expected: FAIL（`changelogUtils` が存在しない）

- [ ] **Step 3: changelogUtils.js を実装する**

```js
// src/utils/changelogUtils.js
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

/** 追跡対象フィールドの日本語ラベルマッピング */
export const FIELD_LABELS = {
  name:                    '氏名',
  chartNumber:             'カルテ番号',
  phone:                   '電話番号',
  addressKarte:            '住所（カルテ）',
  addressVisit:            '住所（訪問先）',
  isFacility:              '施設区分',
  facilityName:            '施設名',
  hasLongTermCareInsurance:'介護保険',
  careLevel:               '介護度',
  careLevelDate:           '介護度認定日',
  insuranceExpiryDate:     '介護保険期限',
  visitSchedule:           '訪問スケジュール',
  doctorVisitCountPlan:    '医師訪問回数（予定）',
  hygienistVisitCountPlan: '歯科衛生士訪問回数（予定）',
  hasCareManager:          'ケアマネあり',
  careManagerName:         'ケアマネ名',
  careManagerFacility:     'ケアマネ施設',
  careManagerPhone:        'ケアマネ電話',
  careManagerFax:          'ケアマネFAX',
  collectionMethod:        '回収方法',
  status:                  'ステータス',
  statusDate:              'ステータス変更日',
  statusReason:            'ステータス変更理由',
  notes:                   '備考',
  firstVisitDate:          '初診日',
  visitNumber:             '訪問登録番号',
}

/**
 * 2つのフォームオブジェクトを比較し、変更されたフィールドの差分リストを返す。
 * FIELD_LABELS に含まれるフィールドのみを対象とする。
 * null/undefined は空文字として扱う。
 *
 * @param {object} original - 変更前のフォームデータ
 * @param {object} updated  - 変更後のフォームデータ
 * @returns {Array<{field: string, label: string, oldValue: string, newValue: string}>}
 */
export function computeFormDiff(original, updated) {
  const changes = []
  for (const field of Object.keys(FIELD_LABELS)) {
    const oldVal = String(original[field] ?? '')
    const newVal = String(updated[field] ?? '')
    if (oldVal !== newVal) {
      changes.push({ field, label: FIELD_LABELS[field], oldValue: oldVal, newValue: newVal })
    }
  }
  return changes
}

/**
 * changelog サブコレクションに1エントリを追記する。
 * changes が空の場合は何もしない。
 * タイムスタンプは Firestore サーバー側で付与するため改竄不可。
 *
 * @param {string} patientId
 * @param {string} staffName  - 変更者名
 * @param {Array<{field, label, oldValue, newValue}>} changes
 */
export async function addChangelogEntry(patientId, staffName, changes) {
  if (changes.length === 0) return
  await addDoc(collection(db, 'patients', patientId, 'changelog'), {
    changedAt: serverTimestamp(),
    staffName,
    changes,
  })
}

/**
 * 最新 N 件の changelog を取得する（新しい順）。
 *
 * @param {string} patientId
 * @param {number} limitCount
 * @returns {Promise<Array<{id, changedAt, staffName, changes}>>}
 */
export async function getLatestChangelog(patientId, limitCount = 5) {
  const snap = await getDocs(
    query(
      collection(db, 'patients', patientId, 'changelog'),
      orderBy('changedAt', 'desc'),
      limit(limitCount)
    )
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm run test:run -- src/tests/changelogUtils.test.js
```

Expected: PASS（5テスト全通過）

- [ ] **Step 5: コミット**

```bash
git add src/utils/changelogUtils.js src/tests/changelogUtils.test.js
git commit -m "feat: add changelog utility functions with tests"
```

---

## Task 2: InlineEditCell — 変更者名入力 + 呼び出し側の更新

**Files:**
- Modify: `src/components/datacheck/InlineEditCell.jsx`
- Modify: `src/components/datacheck/MonthlyPrepCheck.jsx`
- Modify: `src/components/datacheck/QualityCheck.jsx`

`onSave` のシグネチャを `(value)` → `(value, staffName)` に変更する。呼び出し側（MonthlyPrepCheck・QualityCheck）も合わせて更新し changelog を書き込む。

- [ ] **Step 1: InlineEditCell.jsx を更新する**

`src/components/datacheck/InlineEditCell.jsx` を以下に差し替える：

```jsx
// src/components/datacheck/InlineEditCell.jsx
import { useState } from 'react'

const COLLECTION_METHOD_OPTIONS = [
  { value: 'transfer',           label: '振込' },
  { value: 'on_site_self',       label: '現地本人' },
  { value: 'on_site_facility',   label: '現地施設立替' },
  { value: 'family_at_clinic',   label: '親族窓口' },
]

/**
 * クリックで編集モードに切り替わるインラインセル
 *
 * @param {string}   value            - 現在の値
 * @param {'text'|'date'|'month'|'number'|'select'} type
 * @param {Function} onSave           - async (newValue: string, staffName: string) => void
 * @param {string}   placeholder      - 未設定時のテキスト
 * @param {string}   [displayClassName] - 表示値に適用する追加クラス
 * @param {string}   [displaySuffix]  - 表示値の後に追加するテキスト
 */
export default function InlineEditCell({
  value,
  type = 'text',
  onSave,
  placeholder = '（未設定）',
  displayClassName,
  displaySuffix,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [staffName, setStaffName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const handleEdit = () => {
    setDraft(value ?? '')
    setStaffName('')
    setSaveError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    if (!staffName.trim()) {
      setSaveError('変更者名を入力してください')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(draft, staffName.trim())
      setEditing(false)
    } catch {
      setSaveError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Escape') setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={handleEdit}
        className="text-left w-full hover:bg-blue-50 px-2 py-1 rounded transition-colors min-h-[28px]"
      >
        {value ? (
          <span className={displayClassName}>
            {value}
            {displaySuffix && <span className="text-xs">{displaySuffix}</span>}
          </span>
        ) : (
          <span className="text-slate-400 italic text-xs">{placeholder}</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5" onKeyDown={handleKeyDown}>
      {/* 値入力 */}
      <div className="flex items-center gap-2">
        {type === 'select' ? (
          <select
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">選択してください</option>
            {COLLECTION_METHOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
          />
        )}
      </div>
      {/* 変更者名入力 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={staffName}
          onChange={e => setStaffName(e.target.value)}
          placeholder="変更者名"
          className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 w-28"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? '保存中' : '保存'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300"
        >
          キャンセル
        </button>
      </div>
      {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
    </div>
  )
}
```

- [ ] **Step 2: MonthlyPrepCheck.jsx の handleSave を更新する**

`src/components/datacheck/MonthlyPrepCheck.jsx` の import と `handleSave` を以下に変更する：

```jsx
// 追加 import（ファイル先頭）
import { addChangelogEntry, FIELD_LABELS } from '../../utils/changelogUtils'
```

```jsx
// handleSave を以下に差し替える
async function handleSave(patientId, field, value, staffName) {
  // changelog用に変更前の値を保持
  const oldValue = String(patients.find(p => p.id === patientId)?.[field] ?? '')
  await updateDoc(doc(db, 'patients', patientId), { [field]: value })
  // changelog 書き込み（失敗してもメインの保存は影響しない）
  try {
    await addChangelogEntry(patientId, staffName, [{
      field,
      label: FIELD_LABELS[field] ?? field,
      oldValue,
      newValue: String(value),
    }])
  } catch (err) {
    console.error('changelog write failed:', err)
  }
  setPatients(prev => prev.map(p => p.id === patientId ? { ...p, [field]: value } : p))
}
```

各 `InlineEditCell` の `onSave` を `staffName` を受け取る形に変更する（MonthlyPrepCheck.jsx 内の全 `onSave` prop）：

```jsx
// 変更前
onSave={v => handleSave(p.id, 'insuranceExpiryDate', v)}
// 変更後
onSave={(v, staffName) => handleSave(p.id, 'insuranceExpiryDate', v, staffName)}
```

同様に careLevel・careManagerFax・visitSchedule の `onSave` も全て `(v, staffName) => handleSave(p.id, 'フィールド名', v, staffName)` に変更する。

- [ ] **Step 3: QualityCheck.jsx の handleSave を更新する**

`src/components/datacheck/QualityCheck.jsx` の import と `handleSave` を以下に変更する：

```jsx
// 追加 import
import { addChangelogEntry, FIELD_LABELS } from '../../utils/changelogUtils'
```

```jsx
// handleSave を以下に差し替える
async function handleSave(patientId, field, value, staffName) {
  const coerced = field === 'visitNumber'
    ? (value === '' ? null : (isNaN(Number(value)) ? null : Number(value)))
    : value
  const oldValue = String(patients.find(p => p.id === patientId)?.[field] ?? '')
  await updateDoc(doc(db, 'patients', patientId), { [field]: coerced })
  try {
    await addChangelogEntry(patientId, staffName, [{
      field,
      label: FIELD_LABELS[field] ?? field,
      oldValue,
      newValue: String(coerced ?? ''),
    }])
  } catch (err) {
    console.error('changelog write failed:', err)
  }
  setPatients(prev => {
    const updated = prev.map(p =>
      p.id === patientId ? { ...p, [field]: coerced } : p
    )
    setChecks(runQualityChecks(updated))
    return updated
  })
}
```

QualityCheck.jsx 内の `InlineEditCell` の `onSave` を更新する：

```jsx
// 変更前
onSave={v => handleSave(p.id, field, v)}
// 変更後
onSave={(v, staffName) => handleSave(p.id, field, v, staffName)}
```

- [ ] **Step 4: 全テストが通ることを確認**

```bash
npm run test:run
```

Expected: PASS（全テスト通過）

- [ ] **Step 5: コミット**

```bash
git add src/components/datacheck/InlineEditCell.jsx src/components/datacheck/MonthlyPrepCheck.jsx src/components/datacheck/QualityCheck.jsx
git commit -m "feat: add staff name input to InlineEditCell and wire changelog"
```

---

## Task 3: StatusChangeDialog + Patients.jsx — スタッフ名 + changelog

**Files:**
- Modify: `src/components/StatusChangeDialog.jsx`
- Modify: `src/pages/Patients.jsx`

- [ ] **Step 1: StatusChangeDialog.jsx に staffName フィールドを追加する**

state に `staffName` を追加し、`useEffect` のリセット処理と `handleConfirm` のバリデーション・引数に組み込む：

```jsx
// src/components/StatusChangeDialog.jsx 全体

import { useState, useEffect } from 'react'
import { getStatusLabel } from '../utils/patientUtils'

const STATUS_BADGE = {
  active:    'bg-emerald-100 text-emerald-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  ended:     'bg-slate-100 text-slate-600',
  deceased:  'bg-red-100 text-red-700',
}

/**
 * ステータス変更ダイアログ
 *
 * @param {boolean}  props.open
 * @param {object}   props.patient    - { id, name }
 * @param {string}   props.newStatus  - 変更先ステータス
 * @param {Function} props.onConfirm  - async ({ statusDate, statusReason, staffName }) => void
 * @param {Function} props.onCancel
 */
export function StatusChangeDialog({ open, patient, newStatus, onConfirm, onCancel }) {
  const [statusDate, setStatusDate] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [staffName, setStaffName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setStatusDate('')
      setStatusReason('')
      setStaffName('')
      setSaving(false)
      setError(null)
    }
  }, [open])

  if (!open || !patient) return null

  const reasonRequired = ['ended', 'deceased'].includes(newStatus)

  const handleConfirm = async () => {
    if (reasonRequired && !statusReason.trim()) {
      setError('理由を入力してください')
      return
    }
    if (!staffName.trim()) {
      setError('変更者名を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm({ statusDate, statusReason: statusReason.trim(), staffName: staffName.trim() })
    } catch {
      setError('保存に失敗しました')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onKeyDown={e => e.key === 'Escape' && onCancel()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">ステータス変更</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-medium text-slate-700">{patient.name}</span> のステータスを変更します
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">変更後：</span>
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[newStatus] ?? 'bg-slate-100 text-slate-600'}`}>
            {getStatusLabel(newStatus)}
          </span>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            変更日<span className="text-xs font-normal text-slate-400 ml-1">（任意）</span>
          </label>
          <input type="date" value={statusDate} onChange={e => setStatusDate(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            理由
            {reasonRequired
              ? <span className="text-red-500 ml-1">*</span>
              : <span className="text-xs font-normal text-slate-400 ml-1">（任意）</span>}
          </label>
          <textarea rows={3} value={statusReason} onChange={e => setStatusReason(e.target.value)}
            placeholder={reasonRequired ? '理由を入力してください' : '（省略可）'}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            変更者名<span className="text-red-500 ml-1">*</span>
          </label>
          <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)}
            placeholder="例：田中衛生士"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            キャンセル
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50">
            {saving ? '保存中...' : '変更する'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Patients.jsx の handleStatusConfirm に changelog を追加する**

`src/pages/Patients.jsx` の先頭 import に追加：

```jsx
import { addChangelogEntry } from '../utils/changelogUtils'
import { getStatusLabel } from '../utils/patientUtils'  // すでにある場合はスキップ
```

`handleStatusConfirm` を以下に差し替える：

```jsx
const handleStatusConfirm = async ({ statusDate, statusReason, staffName }) => {
  const { patient, newStatus } = statusDialog
  const oldStatus = patient.status ?? 'active'
  await updateDoc(doc(db, 'patients', patient.id), {
    status: newStatus,
    statusDate: statusDate || '',
    statusReason: statusReason || '',
    updatedAt: serverTimestamp(),
  })
  // ステータス関連フィールドのみ changelog に記録
  const changes = [
    { field: 'status', label: 'ステータス', oldValue: getStatusLabel(oldStatus), newValue: getStatusLabel(newStatus) },
  ]
  if (statusDate) {
    changes.push({ field: 'statusDate', label: 'ステータス変更日', oldValue: patient.statusDate || '', newValue: statusDate })
  }
  if (statusReason) {
    changes.push({ field: 'statusReason', label: 'ステータス変更理由', oldValue: patient.statusReason || '', newValue: statusReason })
  }
  try {
    await addChangelogEntry(patient.id, staffName, changes)
  } catch (err) {
    console.error('changelog write failed:', err)
    addToast({ message: '変更ログの記録に失敗しました', type: 'error' })
  }
  setPatients(prev => prev.map(p =>
    p.id === patient.id ? { ...p, status: newStatus, statusDate, statusReason } : p
  ))
  addToast({ message: 'ステータスを更新しました', type: 'success' })
  setStatusDialog(null)
}
```

- [ ] **Step 3: 全テストが通ることを確認**

```bash
npm run test:run
```

Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/components/StatusChangeDialog.jsx src/pages/Patients.jsx
git commit -m "feat: add staff name to status change dialog and log to changelog"
```

---

## Task 4: PatientForm — 変更者名 + 旧値差分 + changelog

**Files:**
- Modify: `src/pages/PatientForm.jsx`

- [ ] **Step 1: import・state・useEffect を更新する**

ファイル先頭の import に追加：

```jsx
import { addChangelogEntry, computeFormDiff } from '../utils/changelogUtils'
```

`export default function PatientForm()` 内の state 宣言に追加：

```jsx
const [originalForm, setOriginalForm] = useState(null)  // 編集前の元データ（diff計算用）
const [staffName, setStaffName] = useState('')
```

`useEffect` 内の `.then()` を以下に変更（`setForm` の直後に `setOriginalForm` を追加）：

```jsx
useEffect(() => {
  if (!isEditing) return
  getDoc(doc(db, 'patients', id))
    .then(snap => {
      if (snap.exists()) {
        const data = { ...INITIAL_FORM, ...snap.data() }
        setForm(data)
        setOriginalForm(data)   // ← 追加: diff計算用に元データを保持
      } else {
        addToast({ message: '患者が見つかりません', type: 'error' })
        navigate('/patients')
      }
    })
    .catch(() => addToast({ message: '読み込みに失敗しました', type: 'error' }))
    .finally(() => setLoading(false))
}, [id, isEditing, navigate, addToast])
```

- [ ] **Step 2: validate に staffName チェックを追加する**

```jsx
const validate = () => {
  if (!form.name.trim()) {
    addToast({ message: '氏名は必須です', type: 'warning' }); return false
  }
  if (['ended', 'deceased'].includes(form.status) && !form.statusReason.trim()) {
    addToast({ message: '終了・逝去の場合は変更理由を入力してください', type: 'warning' }); return false
  }
  // 編集時のみ変更者名が必須
  if (isEditing && !staffName.trim()) {
    addToast({ message: '変更者名を入力してください', type: 'warning' }); return false
  }
  return true
}
```

- [ ] **Step 3: handleSubmit に changelog 書き込みを追加する**

```jsx
const handleSubmit = async e => {
  e.preventDefault()
  if (!validate()) return
  setSaving(true)
  try {
    const data = { ...form, updatedAt: serverTimestamp() }
    if (isEditing) {
      await setDoc(doc(db, 'patients', id), data, { merge: true })
      // 変更されたフィールドのみ changelog に記録
      if (originalForm) {
        const changes = computeFormDiff(originalForm, form)
        if (changes.length > 0) {
          try {
            await addChangelogEntry(id, staffName.trim(), changes)
          } catch (err) {
            console.error('changelog write failed:', err)
            addToast({ message: '変更ログの記録に失敗しました', type: 'error' })
          }
        }
      }
    } else {
      data.createdAt = serverTimestamp()
      await addDoc(collection(db, 'patients'), data)
    }
    addToast({ message: '保存しました', type: 'success' })
    navigate('/patients')
  } catch {
    addToast({ message: '保存に失敗しました。もう一度お試しください', type: 'error' })
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 4: JSX に変更者名フィールドを追加する**

`<form>` 内の保存ボタン（`<button type="submit">` を含む div）の直前に以下を追加する（編集時のみ表示）：

```jsx
{/* 変更者名（編集時のみ） */}
{isEditing && (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        変更者名<span className="text-red-500 ml-0.5">*</span>
      </label>
      <input
        type="text"
        value={staffName}
        onChange={e => setStaffName(e.target.value)}
        placeholder="例：田中衛生士"
        className={inputCls}
      />
      <p className="text-xs text-slate-400 mt-1">変更ログに記録されます</p>
    </div>
  </div>
)}
```

保存ボタンの div は PatientForm.jsx の最下部にある。以下のパターンを探して、その直前に上記ブロックを挿入する：

```jsx
{/* 保存ボタン */}
<div className="flex justify-end gap-3">
```

- [ ] **Step 5: 全テストが通ることを確認**

```bash
npm run test:run
```

Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/pages/PatientForm.jsx
git commit -m "feat: add staff name field and changelog to patient form"
```

---

## Task 5: ChangelogModal — 履歴表示モーダル

**Files:**
- Create: `src/components/ChangelogModal.jsx`

- [ ] **Step 1: ChangelogModal.jsx を作成する**

```jsx
// src/components/ChangelogModal.jsx
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getLatestChangelog } from '../utils/changelogUtils'
import { History, X } from 'lucide-react'

/**
 * 患者の変更ログを最新5件表示するモーダル
 *
 * @param {boolean} props.open
 * @param {object}  props.patient - { id, name }
 * @param {Function} props.onClose
 */
export function ChangelogModal({ open, patient, onClose }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // モーダルを開くたびに最新データを取得
  useEffect(() => {
    if (!open || !patient) return
    setLoading(true)
    setError(null)
    getLatestChangelog(patient.id)
      .then(setEntries)
      .catch(() => setError('履歴の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [open, patient])

  if (!open || !patient) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              {patient.name} の変更ログ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* コンテンツ */}
        {loading && (
          <div className="py-8 text-center text-slate-400 text-sm">読み込み中...</div>
        )}
        {error && (
          <div className="py-4 text-center text-red-500 text-sm">{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-sm">変更履歴はありません</div>
        )}
        {!loading && !error && entries.map(entry => (
          <div key={entry.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">
                {/* changedAt は Firestore Timestamp — toDate() で Date に変換 */}
                {entry.changedAt ? format(entry.changedAt.toDate(), 'yy/MM/dd HH:mm') : '—'}
              </span>
              <span className="text-slate-500">変更者: {entry.staffName}</span>
            </div>
            <ul className="space-y-1">
              {entry.changes.map((c, i) => (
                <li key={i} className="text-xs text-slate-600">
                  <span className="font-medium text-slate-700">{c.label}</span>
                  {'　'}
                  <span className="line-through text-slate-400">{c.oldValue || '（未設定）'}</span>
                  {' → '}
                  <span className="text-slate-800">{c.newValue || '（未設定）'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="text-xs text-slate-400 text-right">最新5件を表示</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/ChangelogModal.jsx
git commit -m "feat: add ChangelogModal component"
```

---

## Task 6: Patients.jsx — 履歴ボタン追加 + ChangelogModal 接続

**Files:**
- Modify: `src/pages/Patients.jsx`

- [ ] **Step 1: import を追加する**

`src/pages/Patients.jsx` の先頭 import に追加（既存 import の末尾に追記）：

```jsx
import { History } from 'lucide-react'
import { ChangelogModal } from '../components/ChangelogModal'
```

- [ ] **Step 2: state を追加する**

既存 state 宣言群の末尾に追加：

```jsx
const [changelogPatient, setChangelogPatient] = useState(null)
```

- [ ] **Step 3: 各行に履歴ボタンを追加する**

患者一覧テーブルの「操作」列（`<td className="px-4 py-3 text-right">` の中）を以下に変更する：

```jsx
<td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
  <div className="flex items-center justify-end gap-3">
    <button
      onClick={() => setChangelogPatient(p)}
      className="text-slate-400 hover:text-slate-600 transition-colors"
      title="変更ログを確認"
    >
      <History className="h-4 w-4" />
    </button>
    <Link
      to={`/patients/${p.id}`}
      onClick={e => e.stopPropagation()}
      className="text-xs text-blue-600 hover:underline"
    >
      編集
    </Link>
  </div>
</td>
```

- [ ] **Step 4: ChangelogModal を描画する**

`</div>` の直前（`<StatusChangeDialog ... />` の下）に追加：

```jsx
<ChangelogModal
  open={!!changelogPatient}
  patient={changelogPatient}
  onClose={() => setChangelogPatient(null)}
/>
```

- [ ] **Step 5: 全テストが通ることを確認**

```bash
npm run test:run
```

Expected: PASS（全テスト通過）

- [ ] **Step 6: コミット**

```bash
git add src/pages/Patients.jsx
git commit -m "feat: add changelog history button to patient list"
```

---

## 完成後の確認チェックリスト

- [ ] データ品質チェック・月次準備チェックのインライン編集で「変更者名」入力欄が出る
- [ ] 変更者名を空のまま保存しようとするとエラーが表示される
- [ ] ステータス変更ダイアログに「変更者名」欄が追加されている
- [ ] 患者編集フォーム（編集時のみ）に「変更者名」欄が表示される
- [ ] 患者一覧の各行右端に履歴アイコンが表示される
- [ ] 履歴アイコンをクリックするとモーダルが開き変更ログが表示される
- [ ] 変更ログに日時（yy/MM/dd HH:mm）・変更者名・旧値→新値が記録される
- [ ] 変更がない状態で PatientForm を保存しても changelog に書き込まれない
- [ ] `npm run test:run` で全テスト通過
