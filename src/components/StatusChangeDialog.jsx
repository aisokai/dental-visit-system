// src/components/StatusChangeDialog.jsx
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
 * @param {object}   props.patient   - { id, name }
 * @param {string}   props.newStatus - 変更先ステータス
 * @param {Function} props.onConfirm - async ({ statusDate, statusReason, staffName }) => void
 * @param {Function} props.onCancel
 */
export function StatusChangeDialog({ open, patient, newStatus, onConfirm, onCancel }) {
  const [statusDate, setStatusDate] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [staffName, setStaffName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // ダイアログを開くたびにフォームをリセット
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

  // ended・deceased は理由が必須
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
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Escape' && !saving) onCancel()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
        {/* ヘッダー */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">ステータス変更</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-medium text-slate-700">{patient.name}</span> のステータスを変更します
          </p>
        </div>

        {/* 変更先ステータス表示 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">変更後：</span>
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[newStatus] ?? 'bg-slate-100 text-slate-600'}`}>
            {getStatusLabel(newStatus)}
          </span>
        </div>

        {/* 変更日 */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            変更日
            <span className="text-xs font-normal text-slate-400 ml-1">（任意）</span>
          </label>
          <input
            type="date"
            value={statusDate}
            onChange={e => setStatusDate(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* 理由 */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            理由
            {reasonRequired
              ? <span className="text-red-500 ml-1">*</span>
              : <span className="text-xs font-normal text-slate-400 ml-1">（任意）</span>
            }
          </label>
          <textarea
            rows={3}
            value={statusReason}
            onChange={e => setStatusReason(e.target.value)}
            placeholder={reasonRequired ? '理由を入力してください' : '（省略可）'}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        {/* 変更者名 */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            変更者名<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={staffName}
            onChange={e => setStaffName(e.target.value)}
            placeholder="例：田中衛生士"
            maxLength={50}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* ボタン */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '変更する'}
          </button>
        </div>
      </div>
    </div>
  )
}
