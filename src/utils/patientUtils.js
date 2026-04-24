// src/utils/patientUtils.js
import { differenceInDays } from 'date-fns'

/**
 * 介護保険期限の状態を返す
 * @param {string|null} dateStr - "YYYY-MM" 形式
 * @returns {'expired' | 'warning' | 'ok' | 'none'}
 */
export function getInsuranceExpiryStatus(dateStr) {
  if (!dateStr) return 'none'
  const [year, month] = dateStr.split('-').map(Number)
  // その月の最終日を期限とする
  const expiry = new Date(year, month, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntil = differenceInDays(expiry, today)
  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 60) return 'warning'  // 2ヶ月以内は警告
  return 'ok'
}

/**
 * 介護保険期限までの残り日数を返す（期限切れは負の値）
 * @param {string|null} dateStr - "YYYY-MM" 形式
 * @returns {number|null}
 */
export function getDaysUntilExpiry(dateStr) {
  if (!dateStr) return null
  const [year, month] = dateStr.split('-').map(Number)
  const expiry = new Date(year, month, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return differenceInDays(expiry, today)
}

/** ステータスコードを日本語ラベルに変換 */
export function getStatusLabel(status) {
  const labels = {
    active: '継続中',
    suspended: '中断中',
    ended: '終了',
    deceased: '逝去',
  }
  return labels[status] ?? status
}

/** 回収方法コードを日本語ラベルに変換 */
export function getCollectionMethodLabel(method) {
  const labels = {
    transfer: '振込',
    on_site_self: '現地本人',
    on_site_facility: '現地施設立替',
    family_at_clinic: '親族窓口',
  }
  return labels[method] ?? '未設定'
}

/** ステータスバッジの Tailwind クラスを返す */
export function getStatusBadgeClass(status) {
  const classes = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    ended: 'bg-slate-100 text-slate-600',
    deceased: 'bg-gray-200 text-gray-600',
  }
  return classes[status] ?? 'bg-slate-100 text-slate-600'
}

/** 介護期限テキストの Tailwind カラークラスを返す */
export function getExpiryColorClass(dateStr) {
  const status = getInsuranceExpiryStatus(dateStr)
  if (status === 'expired') return 'text-red-600 font-semibold'
  if (status === 'warning') return 'text-orange-500 font-semibold'
  return 'text-slate-500'
}
