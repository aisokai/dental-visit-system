// src/components/ChangelogModal.jsx
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getLatestChangelog } from '../utils/changelogUtils'
import { History, X } from 'lucide-react'

/**
 * 患者の変更ログを最新5件表示するモーダル
 *
 * @param {boolean}  props.open
 * @param {object}   props.patient  - { id, name }
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
    setEntries([])  // 再オープン時にフラッシュを防ぐためリセット
    getLatestChangelog(patient.id)
      .then(setEntries)
      .catch(() => setError('履歴の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [open, patient?.id])  // patient.id のみで比較（オブジェクト参照の不要な再フェッチを防ぐ）

  // Escape キーでモーダルを閉じる
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !patient) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-modal-title"
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600" />
            <h2 id="changelog-modal-title" className="text-lg font-semibold text-slate-900">
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
                {entry.changedAt && typeof entry.changedAt.toDate === 'function'
                  ? format(entry.changedAt.toDate(), 'yy/MM/dd HH:mm')
                  : '—'}
              </span>
              <span className="text-slate-500">変更者: {entry.staffName}</span>
            </div>
            <ul className="space-y-1">
              {/* key={i} は entries が再ソート・フィルタされない前提で安全 */}
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
