import { describe, it, expect } from 'vitest'
import { computeFormDiff, FIELD_LABELS } from '../utils/changelogUtils'

describe('FIELD_LABELS', () => {
  it('主要フィールドのラベルが定義されている', () => {
    expect(FIELD_LABELS.name).toBe('氏名')
    expect(FIELD_LABELS.insuranceExpiryDate).toBe('介護保険期限')
    expect(FIELD_LABELS.status).toBe('ステータス')
    expect(FIELD_LABELS.careManagerFax).toBe('ケアマネFAX')
  })
})

describe('computeFormDiff', () => {
  const base = {
    name: '田中太郎',
    insuranceExpiryDate: '2025-04',
    careLevel: '要介護3',
    status: 'active',
    phone: '',
  }

  it('変更なしの場合は空配列を返す', () => {
    expect(computeFormDiff(base, { ...base })).toHaveLength(0)
  })

  it('変更されたフィールドのみ返す', () => {
    const updated = { ...base, insuranceExpiryDate: '2026-04', careLevel: '要介護4' }
    const diff = computeFormDiff(base, updated)
    expect(diff).toHaveLength(2)
    const expiry = diff.find(d => d.field === 'insuranceExpiryDate')
    expect(expiry.oldValue).toBe('2025-04')
    expect(expiry.newValue).toBe('2026-04')
    expect(expiry.label).toBe('介護保険期限')
  })

  it('FIELD_LABELS に含まれないフィールドは無視する', () => {
    const updated = { ...base, unknownField: 'foo', createdAt: 'bar' }
    expect(computeFormDiff(base, updated)).toHaveLength(0)
  })

  it('null と空文字は同じ扱い（差分なし）', () => {
    const original = { ...base, phone: null }
    const updated = { ...base, phone: '' }
    expect(computeFormDiff(original, updated)).toHaveLength(0)
  })

  it('boolean フィールドの変更を検出する', () => {
    const updated = { ...base, isFacility: true }
    const diff = computeFormDiff({ ...base, isFacility: false }, updated)
    expect(diff).toHaveLength(1)
    expect(diff[0].field).toBe('isFacility')
    expect(diff[0].oldValue).toBe('false')
    expect(diff[0].newValue).toBe('true')
  })
})
