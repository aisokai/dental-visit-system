// src/tests/checkUtils.test.js
import { describe, it, expect } from 'vitest'
import { runQualityChecks } from '../utils/checkUtils'

const BASE = {
  id: 'p1', name: 'テスト太郎',
  firstVisitDate: '2024-10-01', visitNumber: 1,
  hasLongTermCareInsurance: false, insuranceExpiryDate: '2026-10',
  hasCareManager: false, careManagerFax: '',
  collectionMethod: 'transfer',
}

describe('runQualityChecks', () => {
  it('A1: firstVisitDateが空の患者を検出する', () => {
    const patients = [
      { ...BASE, id: 'p1', firstVisitDate: '' },
      { ...BASE, id: 'p2', firstVisitDate: '2024-10-01' },
    ]
    const r = runQualityChecks(patients)
    expect(r.A1).toHaveLength(1)
    expect(r.A1[0].id).toBe('p1')
  })

  it('A1: firstVisitDateがnullの患者も検出する', () => {
    const patients = [{ ...BASE, id: 'p1', firstVisitDate: null }]
    expect(runQualityChecks(patients).A1).toHaveLength(1)
  })

  it('A2: visitNumberがnullの患者を検出する', () => {
    const patients = [
      { ...BASE, id: 'p1', visitNumber: null },
      { ...BASE, id: 'p2', visitNumber: 1 },
    ]
    const r = runQualityChecks(patients)
    expect(r.A2).toHaveLength(1)
    expect(r.A2[0].id).toBe('p1')
  })

  it('A3: visitNumberが重複する患者を両方検出する', () => {
    const patients = [
      { ...BASE, id: 'p1', visitNumber: 5 },
      { ...BASE, id: 'p2', visitNumber: 5 },
      { ...BASE, id: 'p3', visitNumber: 6 },
    ]
    expect(runQualityChecks(patients).A3).toHaveLength(2)
  })

  it('A4: hasLongTermCareInsurance=trueでinsuranceExpiryDateが空の患者を検出する', () => {
    const patients = [
      { ...BASE, id: 'p1', hasLongTermCareInsurance: true, insuranceExpiryDate: '' },
      { ...BASE, id: 'p2', hasLongTermCareInsurance: true, insuranceExpiryDate: '2026-10' },
      { ...BASE, id: 'p3', hasLongTermCareInsurance: false, insuranceExpiryDate: '' },
    ]
    const r = runQualityChecks(patients)
    expect(r.A4).toHaveLength(1)
    expect(r.A4[0].id).toBe('p1')
  })

  it('A5: hasCareManager=trueでcareManagerFaxが空の患者を検出する', () => {
    const patients = [
      { ...BASE, id: 'p1', hasCareManager: true, careManagerFax: '' },
      { ...BASE, id: 'p2', hasCareManager: true, careManagerFax: '06-1234-5678' },
      { ...BASE, id: 'p3', hasCareManager: false, careManagerFax: '' },
    ]
    const r = runQualityChecks(patients)
    expect(r.A5).toHaveLength(1)
    expect(r.A5[0].id).toBe('p1')
  })

  it('A6: collectionMethodが空の患者を検出する', () => {
    const patients = [
      { ...BASE, id: 'p1', collectionMethod: '' },
      { ...BASE, id: 'p2', collectionMethod: null },
      { ...BASE, id: 'p3', collectionMethod: 'transfer' },
    ]
    const r = runQualityChecks(patients)
    expect(r.A6).toHaveLength(2)
  })

  it('問題のない患者は全チェックで結果0件', () => {
    const patients = [BASE]
    const r = runQualityChecks(patients)
    Object.values(r).forEach(arr => expect(arr).toHaveLength(0))
  })
})
