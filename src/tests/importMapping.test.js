// src/tests/importMapping.test.js
import { describe, it, expect } from 'vitest'
import { guessCollectionMethod, mapRowToPatient, parsePatientSheet } from '../utils/importMapping'

describe('guessCollectionMethod', () => {
  it('detects transfer', () => {
    expect(guessCollectionMethod('振込（家族へ郵送）')).toBe('transfer')
    expect(guessCollectionMethod('銀行振込')).toBe('transfer')
  })
  it('detects on_site_facility', () => {
    expect(guessCollectionMethod('施設払い（家族預り金より支払い）')).toBe('on_site_facility')
    expect(guessCollectionMethod('施設立替')).toBe('on_site_facility')
  })
  it('detects on_site_self', () => {
    expect(guessCollectionMethod('現地本人から集金')).toBe('on_site_self')
  })
  it('detects family_at_clinic', () => {
    expect(guessCollectionMethod('家族が窓口で支払い')).toBe('family_at_clinic')
  })
  it('returns empty string for unrecognized', () => {
    expect(guessCollectionMethod('その他')).toBe('')
    expect(guessCollectionMethod(null)).toBe('')
    expect(guessCollectionMethod(undefined)).toBe('')
  })
})

describe('mapRowToPatient', () => {
  it('maps 在宅 to isFacility=false', () => {
    const p = mapRowToPatient({ name: 'テスト', _facilityRaw: '在宅', _collectionMethodRaw: '振込', _suspendedRaw: null })
    expect(p.isFacility).toBe(false)
    expect(p.facilityName).toBe('')
  })
  it('maps facility name correctly', () => {
    const p = mapRowToPatient({ name: 'テスト', _facilityRaw: 'グループホーム渭北', _suspendedRaw: null })
    expect(p.isFacility).toBe(true)
    expect(p.facilityName).toBe('グループホーム渭北')
  })
  it('sets hasCareManager=true when careManagerName is present', () => {
    const p = mapRowToPatient({ name: 'テスト', _facilityRaw: '在宅', careManagerName: '山田', _suspendedRaw: null })
    expect(p.hasCareManager).toBe(true)
  })
  it('sets status=suspended when _suspendedRaw is truthy', () => {
    const p = mapRowToPatient({ name: 'テスト', _facilityRaw: '在宅', _suspendedRaw: '中断中' })
    expect(p.status).toBe('suspended')
  })
  it('sets status=active when _suspendedRaw is null', () => {
    const p = mapRowToPatient({ name: 'テスト', _facilityRaw: '在宅', _suspendedRaw: null })
    expect(p.status).toBe('active')
  })
  it('includes all required default fields', () => {
    const p = mapRowToPatient({ name: 'テスト', _facilityRaw: '在宅', _suspendedRaw: null })
    expect(p.phone).toBe('')
    expect(p.addressKarte).toBe('')
    expect(p.hasLongTermCareInsurance).toBe(true)
    expect(p.careLevel).toBe('')
    expect(p.insuranceExpiryDate).toBe('')
    expect(p.notes).toBe('')
    expect(p.addressVisitSameAsKarte).toBe(false)
  })
})

describe('parsePatientSheet', () => {
  it('returns empty patients for empty data', () => {
    const result = parsePatientSheet([])
    expect(result.patients).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('parses rows correctly using header row', () => {
    const sheetData = [
      ['№', '氏名', '往診先(施設名・在宅)', '訪問先所在地', '往診頻度', '支払い方法', 'ケアマネジャー', 'CM氏名', 'TEL', 'FAX', '中断'],
      [1, '田中 洋子', '在宅', '徳島市北田宮3丁目', '隔週', '振込（家族へ郵送）', 'ニチイケアセンター', '岩井', '088-611-1876', '088-611-1877', null],
    ]
    const { patients, errors } = parsePatientSheet(sheetData)
    expect(patients).toHaveLength(1)
    expect(patients[0].name).toBe('田中 洋子')
    expect(patients[0].collectionMethod).toBe('transfer')
    expect(patients[0].hasCareManager).toBe(true)
    expect(patients[0].status).toBe('active')
    expect(errors).toHaveLength(0)
  })

  it('skips rows without name', () => {
    const sheetData = [
      ['№', '氏名', '往診先(施設名・在宅)', '中断'],
      [null, null, '在宅', null],
    ]
    const { patients } = parsePatientSheet(sheetData)
    expect(patients).toHaveLength(0)
  })

  it('parses multiple rows correctly', () => {
    const sheetData = [
      ['№', '氏名', '往診先(施設名・在宅)', '支払い方法', '中断'],
      [1, '田中 洋子', '在宅', '振込', null],
      [2, '鈴木 一郎', 'グループホーム渭北', '施設立替', null],
    ]
    const { patients, errors } = parsePatientSheet(sheetData)
    expect(patients).toHaveLength(2)
    expect(patients[0].name).toBe('田中 洋子')
    expect(patients[1].name).toBe('鈴木 一郎')
    expect(patients[1].isFacility).toBe(true)
    expect(patients[1].facilityName).toBe('グループホーム渭北')
    expect(errors).toHaveLength(0)
  })
})
