// src/components/ConfirmDialog.jsx

/**
 * 汎用確認ダイアログ
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {string} props.message
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {string} [props.confirmLabel='確認する']
 * @param {boolean} [props.danger=false] - true にすると確認ボタンが赤くなる
 */
export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = '確認する',
  danger = false,
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
