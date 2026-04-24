// src/utils/monthlyUtils.js

/**
 * 患者と年月から月次レコードのデフォルト値を生成する
 * faxSent は hasCareManager=true の患者のみ false、それ以外は null
 * @param {{ id: string, hasCareManager?: boolean }} patient
 * @param {string} yearMonth - "YYYY-MM" 形式
 * @returns {object}
 */
export function getDefaultRecord(patient, yearMonth) {
  return {
    patientId: patient.id,
    yearMonth,
    billingAmount: '',
    invoiceIssued: false,
    invoiceDelivered: false,
    invoiceDeliveryMethod: null,
    receiptIssued: false,
    receiptDelivered: false,
    receiptDeliveryMethod: null,
    // ケアマネなし患者は FAX 不要なので null で区別する
    faxSent: patient.hasCareManager ? false : null,
    paymentReceived: false,
    collectionMethodOverride: null,
  }
}

/**
 * 月次レコードが全ステップ完了しているか判定する
 * ケアマネあり患者は faxSent も必須チェック対象
 * @param {object|null|undefined} record
 * @param {{ hasCareManager?: boolean }} patient
 * @returns {boolean}
 */
export function isRecordComplete(record, patient) {
  if (!record) return false
  if (!record.invoiceIssued) return false
  if (!record.invoiceDelivered) return false
  if (!record.receiptIssued) return false
  if (!record.receiptDelivered) return false
  if (patient.hasCareManager && !record.faxSent) return false
  if (!record.paymentReceived) return false
  return true
}
