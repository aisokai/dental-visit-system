import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

/** 追跡対象フィールドの日本語ラベルマッピング */
export const FIELD_LABELS = {
  name:                     '氏名',
  chartNumber:              'カルテ番号',
  phone:                    '電話番号',
  addressKarte:             '住所（カルテ）',
  addressVisit:             '住所（訪問先）',
  isFacility:               '施設区分',
  facilityName:             '施設名',
  hasLongTermCareInsurance: '介護保険',
  careLevel:                '介護度',
  careLevelDate:            '介護度認定日',
  insuranceExpiryDate:      '介護保険期限',
  visitSchedule:            '訪問スケジュール',
  doctorVisitCountPlan:     '医師訪問回数（予定）',
  hygienistVisitCountPlan:  '歯科衛生士訪問回数（予定）',
  hasCareManager:           'ケアマネあり',
  careManagerName:          'ケアマネ名',
  careManagerFacility:      'ケアマネ施設',
  careManagerPhone:         'ケアマネ電話',
  careManagerFax:           'ケアマネFAX',
  collectionMethod:         '回収方法',
  status:                   'ステータス',
  statusDate:               'ステータス変更日',
  statusReason:             'ステータス変更理由',
  notes:                    '備考',
  firstVisitDate:           '初診日',
  visitNumber:              '訪問登録番号',
}

/**
 * 2つのフォームオブジェクトを比較し、変更されたフィールドの差分リストを返す。
 * FIELD_LABELS に含まれるフィールドのみを対象とする。
 * null/undefined は空文字として扱う。
 *
 * @param {object} original - 変更前のフォームデータ
 * @param {object} updated  - 変更後のフォームデータ
 * @returns {Array<{field: string, label: string, oldValue: string, newValue: string}>}
 */
export function computeFormDiff(original, updated) {
  const changes = []
  for (const field of Object.keys(FIELD_LABELS)) {
    const oldVal = String(original[field] ?? '')
    const newVal = String(updated[field] ?? '')
    if (oldVal !== newVal) {
      changes.push({ field, label: FIELD_LABELS[field], oldValue: oldVal, newValue: newVal })
    }
  }
  return changes
}

/**
 * changelog サブコレクションに1エントリを追記する。
 * changes が空の場合は何もしない。
 * タイムスタンプは Firestore サーバー側で付与するため改竄不可。
 *
 * @param {string} patientId
 * @param {string} staffName  - 変更者名
 * @param {Array<{field, label, oldValue, newValue}>} changes
 */
export async function addChangelogEntry(patientId, staffName, changes) {
  if (changes.length === 0) return
  await addDoc(collection(db, 'patients', patientId, 'changelog'), {
    changedAt: serverTimestamp(),
    staffName,
    changes,
  })
}

/**
 * 最新 N 件の changelog を取得する（新しい順）。
 *
 * @param {string} patientId
 * @param {number} limitCount
 * @returns {Promise<Array<{id, changedAt, staffName, changes}>>}
 */
export async function getLatestChangelog(patientId, limitCount = 5) {
  const snap = await getDocs(
    query(
      collection(db, 'patients', patientId, 'changelog'),
      orderBy('changedAt', 'desc'),
      limit(limitCount)
    )
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
