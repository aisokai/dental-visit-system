// src/tests/patientUtils.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getInsuranceExpiryStatus,
  getDaysUntilExpiry,
  getStatusLabel,
  getCollectionMethodLabel,
  getStatusBadgeClass,
  getExpiryColorClass,
} from '../utils/patientUtils'

describe('getInsuranceExpiryStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns "none" when dateStr is empty or null', () => {
    expect(getInsuranceExpiryStatus('')).toBe('none')
    expect(getInsuranceExpiryStatus(null)).toBe('none')
    expect(getInsuranceExpiryStatus(undefined)).toBe('none')
  })

  it('returns "expired" when the last day of the month is past', () => {
    // 2026-03 → 3月31日 → 4月23日時点で期限切れ
    expect(getInsuranceExpiryStatus('2026-03')).toBe('expired')
  })

  it('returns "warning" when expiry is within 30 days', () => {
    // 2026-04 → 4月30日 → 4月23日から7日後なので warning
    expect(getInsuranceExpiryStatus('2026-04')).toBe('warning')
  })

  it('returns "ok" when expiry is more than 30 days away', () => {
    expect(getInsuranceExpiryStatus('2026-07')).toBe('ok')
  })
})

describe('getStatusLabel', () => {
  it('converts English status codes to Japanese labels', () => {
    expect(getStatusLabel('active')).toBe('継続中')
    expect(getStatusLabel('suspended')).toBe('中断中')
    expect(getStatusLabel('ended')).toBe('終了')
    expect(getStatusLabel('deceased')).toBe('逝去')
  })

  it('returns the input value for unknown status', () => {
    expect(getStatusLabel('unknown')).toBe('unknown')
  })
})

describe('getCollectionMethodLabel', () => {
  it('converts method codes to Japanese labels', () => {
    expect(getCollectionMethodLabel('transfer')).toBe('振込')
    expect(getCollectionMethodLabel('on_site_self')).toBe('現地本人')
    expect(getCollectionMethodLabel('on_site_facility')).toBe('現地施設立替')
    expect(getCollectionMethodLabel('family_at_clinic')).toBe('親族窓口')
  })

  it('returns "未設定" for null/undefined/unknown', () => {
    expect(getCollectionMethodLabel(null)).toBe('未設定')
    expect(getCollectionMethodLabel(undefined)).toBe('未設定')
    expect(getCollectionMethodLabel('')).toBe('未設定')
  })
})

describe('getStatusBadgeClass', () => {
  it('returns green class for active', () => {
    expect(getStatusBadgeClass('active')).toContain('green')
  })
  it('returns yellow class for suspended', () => {
    expect(getStatusBadgeClass('suspended')).toContain('yellow')
  })
})

describe('getExpiryColorClass', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns red class for expired', () => {
    expect(getExpiryColorClass('2026-03')).toContain('red')
  })
  it('returns orange class for warning', () => {
    expect(getExpiryColorClass('2026-04')).toContain('orange')
  })
})
