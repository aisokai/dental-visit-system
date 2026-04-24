// src/pages/PatientForm.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from '../context/ToastContext'
import { addChangelogEntry, computeFormDiff } from '../utils/changelogUtils'
import { ArrowLeft, Save, ChevronDown, ChevronRight } from 'lucide-react'

// 定数定義
const CARE_LEVELS = ['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5']
const COLLECTION_METHODS = [
  { value: 'transfer', label: '振込' },
  { value: 'on_site_self', label: '現地本人回収' },
  { value: 'on_site_facility', label: '現地施設立替払い' },
  { value: 'family_at_clinic', label: '親族による窓口支払い' },
]
const STATUSES = [
  { value: 'active', label: '継続中' },
  { value: 'suspended', label: '中断中' },
  { value: 'ended', label: '終了' },
  { value: 'deceased', label: '逝去' },
]

const INITIAL_FORM = {
  name: '',
  chartNumber: '',
  firstVisitDate: '',   // 初診日 "YYYY-MM-DD" 形式
  visitNumber: null,    // 訪問登録番号（スクリプトで自動割り振り）
  phone: '',
  addressKarte: '',
  addressVisit: '',
  addressVisitSameAsKarte: true,
  isFacility: false,
  facilityName: '',
  hasLongTermCareInsurance: true,
  careLevel: '',
  careLevelDate: '',
  insuranceExpiryDate: '',
  visitSchedule: '',
  doctorVisitCountPlan: '',
  hygienistVisitCountPlan: '',
  hasCareManager: false,
  careManagerName: '',
  careManagerFacility: '',
  careManagerPhone: '',
  careManagerFax: '',
  collectionMethod: '',
  status: 'active',
  statusDate: '',
  statusReason: '',
  notes: '',
}

// 共通スタイル
const inputCls = 'block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm'
const selectCls = inputCls + ' bg-white'

function SectionHeader({ title, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 text-left hover:bg-slate-50 transition-colors px-1 rounded-lg"
    >
      <span className="text-base font-semibold text-slate-800">{title}</span>
      {open
        ? <ChevronDown className="h-4 w-4 text-slate-400" />
        : <ChevronRight className="h-4 w-4 text-slate-400" />}
    </button>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function PatientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const isEditing = !!id

  const [form, setForm] = useState(INITIAL_FORM)
  const [originalForm, setOriginalForm] = useState(null)
  const [staffName, setStaffName] = useState('')
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState({ basic: true, care: true, cm: false, payment: false, status: false })

  useEffect(() => {
    if (!isEditing) return
    getDoc(doc(db, 'patients', id))
      .then(snap => {
        if (snap.exists()) {
          const data = { ...INITIAL_FORM, ...snap.data() }
          setForm(data)
          setOriginalForm(data)
        }
        else { addToast({ message: '患者が見つかりません', type: 'error' }); navigate('/patients') }
      })
      .catch(() => addToast({ message: '読み込みに失敗しました', type: 'error' }))
      .finally(() => setLoading(false))
  }, [id, isEditing, navigate, addToast])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const handle = e => {
    const { name, value, type, checked } = e.target
    set(name, type === 'checkbox' ? checked : value)
  }
  const toggle = key => setOpen(prev => ({ ...prev, [key]: !prev[key] }))

  const validate = () => {
    if (!form.name.trim()) {
      addToast({ message: '氏名は必須です', type: 'warning' }); return false
    }
    if (['ended', 'deceased'].includes(form.status) && !form.statusReason.trim()) {
      addToast({ message: '終了・逝去の場合は変更理由を入力してください', type: 'warning' }); return false
    }
    if (isEditing && !staffName.trim()) {
      addToast({ message: '変更者名を入力してください', type: 'warning' }); return false
    }
    return true
  }

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

  if (loading) return <div className="p-8 text-center text-slate-400">読み込み中...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="mr-1 h-4 w-4" />戻る
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? '患者情報編集' : '新規患者登録'}
          </h1>
          {isEditing && form.visitNumber != null && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
              No.{form.visitNumber}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* ① 基本情報 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 border-b border-slate-100">
            <SectionHeader title="① 基本情報" open={open.basic} onToggle={() => toggle('basic')} />
          </div>
          {open.basic && (
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="氏名" required>
                  <input type="text" name="name" required className={inputCls} value={form.name} onChange={handle} />
                </Field>
              </div>
              <Field label="カルテ番号">
                <input type="text" name="chartNumber" className={inputCls} value={form.chartNumber} onChange={handle} />
              </Field>
              <Field label="電話番号">
                <input type="tel" name="phone" className={inputCls} value={form.phone} onChange={handle} />
              </Field>
              <Field label="初診日">
                <input
                  type="date"
                  name="firstVisitDate"
                  className={inputCls}
                  value={form.firstVisitDate}
                  onChange={handle}
                />
              </Field>
              <div className="col-span-2">
                <Field label="カルテ住所（保険請求用）">
                  <input type="text" name="addressKarte" className={inputCls} value={form.addressKarte} onChange={handle} />
                </Field>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="addrSame" name="addressVisitSameAsKarte" checked={form.addressVisitSameAsKarte} onChange={handle} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <label htmlFor="addrSame" className="text-sm text-slate-700">訪問先住所はカルテ住所と同じ</label>
              </div>
              {!form.addressVisitSameAsKarte && (
                <div className="col-span-2">
                  <Field label="訪問先住所">
                    <input type="text" name="addressVisit" className={inputCls} value={form.addressVisit} onChange={handle} />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ② 介護情報 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 border-b border-slate-100">
            <SectionHeader title="② 介護情報" open={open.care} onToggle={() => toggle('care')} />
          </div>
          {open.care && (
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center gap-6">
                {[{ label: '居宅', val: false }, { label: '施設', val: true }].map(opt => (
                  <label key={opt.label} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="isFacility" checked={form.isFacility === opt.val} onChange={() => set('isFacility', opt.val)} className="text-blue-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
              {form.isFacility && (
                <div className="col-span-2">
                  <Field label="施設名">
                    <input type="text" name="facilityName" className={inputCls} value={form.facilityName} onChange={handle} />
                  </Field>
                </div>
              )}
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="hasIns" name="hasLongTermCareInsurance" checked={form.hasLongTermCareInsurance} onChange={handle} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <label htmlFor="hasIns" className="text-sm text-slate-700">介護保険あり</label>
              </div>
              {form.hasLongTermCareInsurance && (
                <>
                  <Field label="介護度">
                    <select name="careLevel" className={selectCls} value={form.careLevel} onChange={handle}>
                      <option value="">選択してください</option>
                      {CARE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="認定日">
                    <input type="date" name="careLevelDate" className={inputCls} value={form.careLevelDate} onChange={handle} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="介護保険有効期限">
                      <input type="month" name="insuranceExpiryDate" className={inputCls} value={form.insuranceExpiryDate} onChange={handle} />
                    </Field>
                  </div>
                </>
              )}
              <Field label="ドクター訪問予定回数 / 月">
                <input type="number" name="doctorVisitCountPlan" min="0" className={inputCls} value={form.doctorVisitCountPlan} onChange={handle} />
              </Field>
              <Field label="衛生士単独訪問予定回数 / 月">
                <input type="number" name="hygienistVisitCountPlan" min="0" className={inputCls} value={form.hygienistVisitCountPlan} onChange={handle} />
              </Field>
              <div className="col-span-2">
                <Field label="訪問スケジュール">
                  <input type="text" name="visitSchedule" placeholder="例：毎週水曜 10:30" className={inputCls} value={form.visitSchedule} onChange={handle} />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* ③ ケアマネジャー情報 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 border-b border-slate-100">
            <SectionHeader title="③ ケアマネジャー情報" open={open.cm} onToggle={() => toggle('cm')} />
          </div>
          {open.cm && (
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="hasCM" name="hasCareManager" checked={form.hasCareManager} onChange={handle} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <label htmlFor="hasCM" className="text-sm text-slate-700">ケアマネジャーあり（FAX送付が必要）</label>
              </div>
              {form.hasCareManager && (
                <>
                  <Field label="CM氏名">
                    <input type="text" name="careManagerName" className={inputCls} value={form.careManagerName} onChange={handle} />
                  </Field>
                  <Field label="事業所名">
                    <input type="text" name="careManagerFacility" className={inputCls} value={form.careManagerFacility} onChange={handle} />
                  </Field>
                  <Field label="電話番号">
                    <input type="tel" name="careManagerPhone" className={inputCls} value={form.careManagerPhone} onChange={handle} />
                  </Field>
                  <Field label="FAX番号">
                    <input type="tel" name="careManagerFax" className={inputCls} value={form.careManagerFax} onChange={handle} />
                  </Field>
                </>
              )}
            </div>
          )}
        </div>

        {/* ④ 支払い・回収方法 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 border-b border-slate-100">
            <SectionHeader title="④ 支払い・回収方法" open={open.payment} onToggle={() => toggle('payment')} />
          </div>
          {open.payment && (
            <div className="px-6 py-4 space-y-3">
              {COLLECTION_METHODS.map(m => (
                <label key={m.value} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-50 p-2 rounded-lg">
                  <input type="radio" name="collectionMethod" value={m.value} checked={form.collectionMethod === m.value} onChange={handle} className="text-blue-600" />
                  {m.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ⑤ ステータス・メモ */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 border-b border-slate-100">
            <SectionHeader title="⑤ ステータス・メモ" open={open.status} onToggle={() => toggle('status')} />
          </div>
          {open.status && (
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <Field label="ステータス">
                <select name="status" className={selectCls} value={form.status} onChange={handle}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              {form.status !== 'active' && (
                <>
                  <Field label="変更日">
                    <input type="date" name="statusDate" className={inputCls} value={form.statusDate} onChange={handle} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="変更理由" required={['ended', 'deceased'].includes(form.status)}>
                      <textarea name="statusReason" rows={2} className={inputCls} value={form.statusReason} onChange={handle} />
                    </Field>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Field label="特記事項・申し送り">
                  <textarea name="notes" rows={3} placeholder="診療上の注意点など" className={inputCls} value={form.notes} onChange={handle} />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* 変更者名（編集時のみ） */}
        {isEditing && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <Field label="変更者名" required>
              <input
                type="text"
                value={staffName}
                onChange={e => setStaffName(e.target.value)}
                placeholder="例：田中衛生士"
                maxLength={50}
                className={inputCls}
              />
            </Field>
            <p className="text-xs text-slate-400 mt-1">変更ログに記録されます</p>
          </div>
        )}

        {/* 保存ボタン */}
        <div className="flex justify-end gap-3 pt-2 pb-8">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
            キャンセル
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors">
            <Save className="mr-2 h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
