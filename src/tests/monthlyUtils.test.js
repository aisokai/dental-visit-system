// src/tests/monthlyUtils.test.js
import { describe, it, expect } from 'vitest'
import { getDefaultRecord, isRecordComplete } from '../utils/monthlyUtils'

describe('getDefaultRecord', () => {
  it('sets faxSent=false for patient with hasCareManager=true', () => {
    const patient = { id: 'p1', hasCareManager: true }
    const record = getDefaultRecord(patient, '2026-04')
    expect(record.faxSent).toBe(false)
    expect(record.patientId).toBe('p1')
    expect(record.yearMonth).toBe('2026-04')
    expect(record.billingAmount).toBe('')
    expect(record.invoiceIssued).toBe(false)
    expect(record.invoiceDelivered).toBe(false)
    expect(record.invoiceDeliveryMethod).toBeNull()
    expect(record.receiptIssued).toBe(false)
    expect(record.receiptDelivered).toBe(false)
    expect(record.receiptDeliveryMethod).toBeNull()
    expect(record.paymentReceived).toBe(false)
    expect(record.collectionMethodOverride).toBeNull()
  })

  it('sets faxSent=null for patient without hasCareManager', () => {
    const patient = { id: 'p2', hasCareManager: false }
    const record = getDefaultRecord(patient, '2026-04')
    expect(record.faxSent).toBeNull()
  })

  it('sets faxSent=null when hasCareManager is undefined', () => {
    const patient = { id: 'p3' }
    const record = getDefaultRecord(patient, '2026-04')
    expect(record.faxSent).toBeNull()
  })
})

describe('isRecordComplete', () => {
  it('returns false for null/undefined record', () => {
    expect(isRecordComplete(null, { hasCareManager: false })).toBe(false)
    expect(isRecordComplete(undefined, { hasCareManager: false })).toBe(false)
  })

  it('returns false if paymentReceived is false (non-CM patient)', () => {
    const patient = { hasCareManager: false }
    const record = {
      invoiceIssued: true, invoiceDelivered: true,
      receiptIssued: true, receiptDelivered: true,
      faxSent: null, paymentReceived: false,
    }
    expect(isRecordComplete(record, patient)).toBe(false)
  })

  it('returns true when all steps complete for non-CM patient', () => {
    const patient = { hasCareManager: false }
    const record = {
      invoiceIssued: true, invoiceDelivered: true,
      receiptIssued: true, receiptDelivered: true,
      faxSent: null, paymentReceived: true,
    }
    expect(isRecordComplete(record, patient)).toBe(true)
  })

  it('returns false if faxSent=false for CM patient', () => {
    const patient = { hasCareManager: true }
    const record = {
      invoiceIssued: true, invoiceDelivered: true,
      receiptIssued: true, receiptDelivered: true,
      faxSent: false, paymentReceived: true,
    }
    expect(isRecordComplete(record, patient)).toBe(false)
  })

  it('returns true when all steps complete including faxSent for CM patient', () => {
    const patient = { hasCareManager: true }
    const record = {
      invoiceIssued: true, invoiceDelivered: true,
      receiptIssued: true, receiptDelivered: true,
      faxSent: true, paymentReceived: true,
    }
    expect(isRecordComplete(record, patient)).toBe(true)
  })

  it('returns false if invoiceIssued is false', () => {
    const patient = { hasCareManager: false }
    const record = {
      invoiceIssued: false, invoiceDelivered: false,
      receiptIssued: false, receiptDelivered: false,
      faxSent: null, paymentReceived: false,
    }
    expect(isRecordComplete(record, patient)).toBe(false)
  })
})
