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
 * @param {Function} onSave - async (newValue: string) => void
 * @param {string} placeholder - 未設定時のテキスト
 */
export default function InlineEditCell({ value, type = 'text', onSave, placeholder = '（未設定）' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const handleEdit = () => {
    setDraft(value ?? '')
    setSaveError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      setSaveError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={handleEdit}
        className="text-left w-full hover:bg-blue-50 px-2 py-1 rounded transition-colors min-h-[28px]"
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-slate-400 italic text-xs">{placeholder}</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
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
            onKeyDown={handleKeyDown}
            autoFocus
            className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
          />
        )}
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
