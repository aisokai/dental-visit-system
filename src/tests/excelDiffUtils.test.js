import { describe, it, expect } from 'vitest'
import { parseExcelDate, computeDiff } from '../utils/excelDiffUtils'

describe('parseExcelDate', () => {
  it('通常形式 YYYY.M.D を変換する', () => {
    expect(parseExcelDate('2024.10.9')).toBe('2024-10-09')
  })
  it('ゼロパディングが必要な日付を変換する', () => {
    expect(parseExcelDate('2025.3.11')).toBe('2025-03-11')
  })
  it('サフィックス付きでも先頭の日付のみ抽出する', () => {
    expect(parseExcelDate('2024.11.11(電話)')).toBe('2024-11-11')
    expect(parseExcelDate('2025.3.11\n3.18(電話)')).toBe('2025-03-11')
  })
  it('空・nullは空文字を返す', () => {
    expect(parseExcelDate('')).toBe('')
    expect(parseExcelDate(null)).toBe('')
    expect(parseExcelDate(undefined)).toBe('')
  })
  it('形式が合わない場合は空文字を返す', () => {
    expect(parseExcelDate('不明')).toBe('')
  })
})

describe('computeDiff', () => {
  const firestorePatients = [
    { id: 'f1', name: '田中太郎', firstVisitDate: '2024-10-01' },
    { id: 'f2', name: '鈴木花子', firstVisitDate: '2024-11-01' },
    { id: 'f3', name: '佐藤次郎', firstVisitDate: '2024-12-01' },
  ]

  it('Excelのみにいる患者を検出する', () => {
    const excelPatients = [
      { name: '田中太郎', firstVisitDate: '2024-10-01' },
      { name: '新規患者', firstVisitDate: '2025-01-01' },
    ]
    const { excelOnly } = computeDiff(excelPatients, firestorePatients)
    expect(excelOnly).toHaveLength(1)
    expect(excelOnly[0].name).toBe('新規患者')
  })

  it('Firestoreのみにいる患者を検出する', () => {
    const excelPatients = [
      { name: '田中太郎', firstVisitDate: '2024-10-01' },
    ]
    const { firestoreOnly } = computeDiff(excelPatients, firestorePatients)
    expect(firestoreOnly).toHaveLength(2)
    expect(firestoreOnly.map(p => p.name)).toContain('鈴木花子')
    expect(firestoreOnly.map(p => p.name)).toContain('佐藤次郎')
  })

  it('firstVisitDateが異なる患者を不一致として検出する', () => {
    const excelPatients = [
      { name: '田中太郎', firstVisitDate: '2024-10-15' },
    ]
    const { mismatched } = computeDiff(excelPatients, firestorePatients)
    expect(mismatched).toHaveLength(1)
    expect(mismatched[0].name).toBe('田中太郎')
    expect(mismatched[0].diffs[0].field).toBe('firstVisitDate')
    expect(mismatched[0].diffs[0].excelValue).toBe('2024-10-15')
    expect(mismatched[0].diffs[0].firestoreValue).toBe('2024-10-01')
    expect(mismatched[0].firestoreId).toBe('f1')
  })

  it('firstVisitDateが一致する患者は不一致に含まない', () => {
    const excelPatients = [
      { name: '田中太郎', firstVisitDate: '2024-10-01' },
    ]
    const { mismatched } = computeDiff(excelPatients, firestorePatients)
    expect(mismatched).toHaveLength(0)
  })

  it('ExcelのfirstVisitDateが空なら初診日の不一致チェックをスキップする', () => {
    const excelPatients = [
      { name: '田中太郎', firstVisitDate: '' },
    ]
    const { mismatched } = computeDiff(excelPatients, firestorePatients)
    expect(mismatched).toHaveLength(0)
  })
})
