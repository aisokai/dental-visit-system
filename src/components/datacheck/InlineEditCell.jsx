import { useState } from 'react'

const COLLECTION_METHOD_OPTIONS = [
  { value: 'transfer', label: '振込' },
  { value: 'on_site_self', label: '現地本人' },
  { value: 'on_site_facility', label: '現地施設立替' },
  { value: 'family_at_clinic', label: '親族窓口' },
]

/**
 * クリックで編集モードに切り替わるインラインセル
 *
 * @param {string} value - 現在の値
 * @param {'text'|'date'|'month'|'number'|'select'} type - input の種類
 * @param {Function} onSave - async (newValue: string, staffName: string) => void
 * @param {string} placeholder - 未設定時のテキスト
 * @param {string} [displayClassName] - 表示値に適用する追加クラス（色付けなど）
 * @param {string} [displaySuffix] - 表示値の後に追加するテキスト（残日数など）
 */
export default function InlineEditCell({ value, type = 'text', onSave, placeholder = '（未設定）', displayClassName, displaySuffix }) {
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
    // 変更者名が未入力の場合はエラーを表示して保存しない
    if (!staffName.trim()) {
      setSaveError('変更者名を入力してください')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(draft, staffName.trim())
      setEditing(false)
    } catch (err) {
      setSaveError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    // Escape キーでキャンセル（Enter での保存は staffName 入力を必須とするため削除）
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
    <div className="flex flex-col gap-1.5">
      {/* Row 1: 値の入力（テキスト・日付・月・数値 or セレクト） */}
      <div>
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
            onKeyDown={handleKeyDown}
            autoFocus
            className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
          />
        )}
      </div>
      {/* Row 2: 変更者名入力 + 保存ボタン + キャンセルボタン */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={staffName}
          onChange={e => setStaffName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="変更者名"
          maxLength={50}
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
          onClick={() => { setEditing(false); setStaffName(''); setSaveError(null) }}
          className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300"
        >
          キャンセル
        </button>
      </div>
      {/* Row 3: エラーメッセージ（条件付き） */}
      {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
    </div>
  )
}
