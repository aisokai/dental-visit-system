// src/utils/importMapping.js
import { format } from 'date-fns'

/** ExcelヘッダーとPatientフィールドのマッピング定義 */
const COLUMN_MAP = {
  '№': 'chartNumber',
  '氏名': 'name',
  '初診日': 'firstVisitDate',  // ← 追加
  '往診先(施設名・在宅)': '_facilityRaw',
  '訪問先所在地': 'addressVisit',
  '往診頻度': 'visitSchedule',
  '支払い方法': '_collectionMethodRaw',
  'ケアマネジャー': 'careManagerFacility',
  'CM氏名': 'careManagerName',
  'TEL': 'careManagerPhone',
  'FAX': 'careManagerFax',
  '中断': '_suspendedRaw',
}

/**
 * 支払い方法の自由記述テキストから collectionMethod コードを推定
 * @param {string|null} raw
 * @returns {'transfer'|'on_site_self'|'on_site_facility'|'family_at_clinic'|''}
 */
export function guessCollectionMethod(raw) {
  if (!raw) return ''
  const s = String(raw)
  if (s.includes('振込')) return 'transfer'
  if (s.includes('施設払い') || s.includes('施設立替')) return 'on_site_facility'
  if (s.includes('現地') || s.includes('本人')) return 'on_site_self'
  if (s.includes('家族') || s.includes('窓口')) return 'family_at_clinic'
  return ''
}

/**
 * Excelの1行データ（フィールドマッピング済み）をPatientオブジェクトに変換
 * @param {object} row
 * @returns {object}
 */
export function mapRowToPatient(row) {
  const facilityRaw = String(row._facilityRaw ?? '').trim()
  const isFacility = facilityRaw !== '' && facilityRaw !== '在宅'

  // Excelの日付セルは数値シリアル値で来ることがあるため変換する
  let firstVisitDate = ''
  if (row.firstVisitDate) {
    const raw = row.firstVisitDate
    if (typeof raw === 'number') {
      // Excel シリアル日付（1900-01-00 起算）を "YYYY-MM-DD" に変換
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + raw * 86400000)
      firstVisitDate = format(date, 'yyyy-MM-dd')
    } else {
      firstVisitDate = String(raw).trim()
    }
  }

  return {
    chartNumber: String(row.chartNumber ?? '').trim(),
    firstVisitDate,  // ← 追加
    name: String(row.name ?? '').trim(),
    isFacility,
    facilityName: isFacility ? facilityRaw : '',
    addressVisit: String(row.addressVisit ?? '').trim(),
    addressVisitSameAsKarte: false,
    visitSchedule: String(row.visitSchedule ?? '').trim(),
    collectionMethod: guessCollectionMethod(row._collectionMethodRaw),
    careManagerFacility: String(row.careManagerFacility ?? '').trim(),
    careManagerName: String(row.careManagerName ?? '').trim(),
    careManagerPhone: String(row.careManagerPhone ?? '').trim(),
    careManagerFax: String(row.careManagerFax ?? '').trim(),
    hasCareManager: !!String(row.careManagerName ?? '').trim(),
    status: row._suspendedRaw ? 'suspended' : 'active',
    // デフォルト値（インポート後に手動で補完）
    phone: '',
    addressKarte: '',
    hasLongTermCareInsurance: true,
    careLevel: '',
    careLevelDate: '',
    insuranceExpiryDate: '',
    doctorVisitCountPlan: '',
    hygienistVisitCountPlan: '',
    notes: '',
  }
}

/**
 * XLSXシートデータ（先頭行=ヘッダー）をPatient配列に変換
 * @param {any[][]} sheetData - XLSX.utils.sheet_to_json(ws, { header: 1 }) の結果
 * @returns {{ patients: object[], errors: string[] }}
 */
export function parsePatientSheet(sheetData) {
  if (!sheetData || sheetData.length < 2) {
    return { patients: [], errors: ['データが空です'] }
  }

  const headers = sheetData[0]
  const nameIdx = headers.indexOf('氏名')
  const errors = []
  const patients = []

  for (let i = 1; i < sheetData.length; i++) {
    const rowArr = sheetData[i]
    if (!rowArr[nameIdx]) continue // 氏名がない行はスキップ

    const row = {}
    headers.forEach((header, idx) => {
      const field = COLUMN_MAP[header]
      if (field) row[field] = rowArr[idx]
    })

    try {
      const patient = mapRowToPatient(row)
      if (patient.name) patients.push(patient)
    } catch (e) {
      errors.push(`行 ${i + 1}: ${e.message}`)
    }
  }

  return { patients, errors }
}
