/**
 * Excel の日付セル文字列 ("YYYY.M.D" + サフィックス可) を "YYYY-MM-DD" に変換する
 * 変換できない場合は空文字を返す
 */
export function parseExcelDate(raw) {
  if (!raw) return ''
  const str = String(raw).trim()
  const m = str.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/)
  if (!m) return ''
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

/**
 * ExcelデータとFirestoreデータの差分を計算する
 * 名前の完全一致で突合する（スペース・全角半角の差異は許容しない）
 *
 * @param {Array<{name: string, firstVisitDate: string}>} excelPatients
 * @param {Array<{id: string, name: string, firstVisitDate: string}>} firestorePatients
 * @returns {{
 *   excelOnly: Array,
 *   firestoreOnly: Array,
 *   mismatched: Array<{name: string, firestoreId: string, diffs: Array<{field: string, excelValue: string, firestoreValue: string}>}>
 * }}
 */
export function computeDiff(excelPatients = [], firestorePatients = []) {
  // NOTE: 患者名の完全一致で突合する。
  // 同姓同名患者が複数いる場合は後方のレコードが優先され、前方のレコードは検出されない。
  // 現在の運用データでは同姓同名は稀なため許容している。
  const firestoreMap = new Map(firestorePatients.map(p => [p.name, p]))
  const excelMap = new Map(excelPatients.map(p => [p.name, p]))

  const excelOnly = excelPatients.filter(p => !firestoreMap.has(p.name))
  const firestoreOnly = firestorePatients.filter(p => !excelMap.has(p.name))

  const mismatched = []
  for (const ep of excelPatients) {
    const fp = firestoreMap.get(ep.name)
    if (!fp) continue
    const diffs = []
    // 初診日: ExcelにDateがある場合のみ比較（空のExcelセルは無視）
    if (ep.firstVisitDate && ep.firstVisitDate !== fp.firstVisitDate) {
      diffs.push({
        field: 'firstVisitDate',
        excelValue: ep.firstVisitDate,
        firestoreValue: fp.firstVisitDate ?? '',
      })
    }
    if (diffs.length > 0) {
      mismatched.push({ name: ep.name, firestoreId: fp.id, diffs })
    }
  }

  return { excelOnly, firestoreOnly, mismatched }
}
