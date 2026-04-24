/**
 * 全患者に対してデータ品質チェックを実行し、問題患者を種別ごとに返す
 * @param {Array} patients - Firestore patients コレクションのドキュメント配列
 * @returns {{ A1: Array, A2: Array, A3: Array, A4: Array, A5: Array, A6: Array }}
 */
export function runQualityChecks(patients) {
  // A3用: visitNumber の出現回数をカウント
  const visitNumberCounts = {}
  for (const p of patients) {
    if (p.visitNumber != null) {
      visitNumberCounts[p.visitNumber] = (visitNumberCounts[p.visitNumber] ?? 0) + 1
    }
  }

  return {
    A1: patients.filter(p => !p.firstVisitDate),
    A2: patients.filter(p => p.visitNumber == null),
    A3: patients.filter(p => p.visitNumber != null && visitNumberCounts[p.visitNumber] > 1),
    A4: patients.filter(p => p.hasLongTermCareInsurance && !p.insuranceExpiryDate),
    A5: patients.filter(p => p.hasCareManager && !p.careManagerFax),
    A6: patients.filter(p => !p.collectionMethod),
  }
}

/** チェック種別のラベル */
export const CHECK_LABELS = {
  A1: '初診日 未設定',
  A2: '訪問登録番号 未設定',
  A3: '訪問登録番号 重複',
  A4: '介護保険期限 未設定（介護保険あり患者）',
  A5: 'ケアマネFAX 未設定（ケアマネあり患者）',
  A6: '回収方法 未設定',
}

/** チェック種別に対応する編集フィールド名 */
export const CHECK_FIELDS = {
  A1: 'firstVisitDate',
  A2: 'visitNumber',
  A3: 'visitNumber',
  A4: 'insuranceExpiryDate',
  A5: 'careManagerFax',
  A6: 'collectionMethod',
}

/** チェック種別に対応する input type */
export const CHECK_INPUT_TYPES = {
  A1: 'date',
  A2: 'number',
  A3: 'number',
  A4: 'month',
  A5: 'text',
  A6: 'select',
}
