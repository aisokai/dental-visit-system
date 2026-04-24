// src/pages/MonthlyInput.jsx
import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { collection, query, where, getDocs, setDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, CheckCircle2, Lock } from 'lucide-react'
import { clsx } from 'clsx'
import { getDefaultRecord, isRecordComplete } from '../utils/monthlyUtils'
import { useToast } from '../context/ToastContext'
import PdfExportButton from '../components/PdfExportButton'

const DELIVERY_METHODS = [
  { value: 'hand', label: '手渡し' },
  { value: 'mail', label: '郵送' },
  { value: 'facility', label: '施設経由' },
]

export default function MonthlyInput() {
  const { addToast } = useToast()
  const [patients, setPatients] = useState([])
  const [records, setRecords] = useState({})
  // useRef で最新の records を常に参照できるようにする（stale closure 対策）
  const recordsRef = useRef(records)
  recordsRef.current = records
  const [monthClosed, setMonthClosed] = useState(false)
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(true)
  const [savingRows, setSavingRows] = useState(new Set())
  const [filter, setFilter] = useState('all') // 'all' | 'incomplete' | 'fax'
  const [groupBy, setGroupBy] = useState('facility') // 'facility' | 'none'

  // 前月・翌月に移動
  const moveMonth = (delta) => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setYearMonth(format(d, 'yyyy-MM'))
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // active患者のみ取得（複合インデックス不要にするため orderBy は使わずクライアントソート）
        const snapPatients = await getDocs(
          query(collection(db, 'patients'), where('status', '==', 'active'))
        )
        const patientsData = snapPatients.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ja'))

        // 月次レコード取得
        const snapRecords = await getDocs(
          query(collection(db, 'monthly_records'), where('yearMonth', '==', yearMonth))
        )
        const recordsMap = {}
        snapRecords.forEach(d => {
          const data = d.data()
          recordsMap[data.patientId] = { id: d.id, ...data }
        })

        // 月次締め状態を取得
        const summarySnap = await getDoc(doc(db, 'monthly_summary', yearMonth))
        setMonthClosed(summarySnap.exists() && summarySnap.data().monthClosed === true)

        // デフォルト値と既存レコードをマージして初期化
        const initialRecords = {}
        patientsData.forEach(p => {
          initialRecords[p.id] = recordsMap[p.id]
            ? { ...getDefaultRecord(p, yearMonth), ...recordsMap[p.id] }
            : getDefaultRecord(p, yearMonth)
        })

        setPatients(patientsData)
        setRecords(initialRecords)
      } catch (err) {
        console.error('月次データ読み込みエラー:', err)
        addToast({ message: 'データの読み込みに失敗しました', type: 'error' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [yearMonth, addToast])

  // 行ごと自動保存（チェックボックス・セレクトの変更時に即時実行）
  const saveRow = useCallback(async (patientId, updatedRecord) => {
    const docId = `${patientId}_${yearMonth}`
    setSavingRows(prev => new Set(prev).add(patientId))
    try {
      const toSave = { ...updatedRecord }
      // 空文字は null に変換（Firestore の型混在を防ぐ）
      toSave.billingAmount = toSave.billingAmount === '' ? null : Number(toSave.billingAmount)
      await setDoc(doc(db, 'monthly_records', docId), toSave, { merge: true })
    } catch {
      addToast({ message: '保存に失敗しました', type: 'error' })
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev)
        next.delete(patientId)
        return next
      })
    }
  }, [yearMonth, addToast])

  // チェックボックス・セレクト変更時（即時保存）
  const handleChange = useCallback((patientId, field, value) => {
    setRecords(prev => {
      const updated = { ...prev[patientId], [field]: value }
      saveRow(patientId, updated)
      return { ...prev, [patientId]: updated }
    })
  }, [saveRow])

  // 金額入力は onBlur で保存（入力中は保存しない）
  const handleAmountChange = useCallback((patientId, value) => {
    setRecords(prev => ({ ...prev, [patientId]: { ...prev[patientId], billingAmount: value } }))
  }, [])

  const handleAmountBlur = useCallback((patientId) => {
    const record = recordsRef.current[patientId]
    if (record) saveRow(patientId, record)
  }, [saveRow])

  // 月次締め
  const handleClose = async () => {
    try {
      await setDoc(doc(db, 'monthly_summary', yearMonth), {
        yearMonth,
        monthClosed: true,
        closedAt: new Date().toISOString(),
      }, { merge: true })
      setMonthClosed(true)
      addToast({ message: `${yearMonth} を締めました`, type: 'success' })
    } catch {
      addToast({ message: '締めに失敗しました', type: 'error' })
    }
  }

  // 全患者が完了しているか（月次締めボタンの活性判定）
  const allComplete = patients.length > 0 && patients.every(p => isRecordComplete(records[p.id], p))

  // フィルタ適用
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      if (filter === 'incomplete') return !isRecordComplete(records[p.id], p)
      if (filter === 'fax') return p.hasCareManager && !records[p.id]?.faxSent
      return true
    })
  }, [patients, records, filter])

  // 施設グループ化
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, patients: filteredPatients, completedCount: 0, totalCount: filteredPatients.length }]
    const map = new Map()
    filteredPatients.forEach(p => {
      const key = p.isFacility ? (p.facilityName || '施設（名称未設定）') : '居宅'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    })
    return [...map.entries()].map(([label, pts]) => ({
      key: label,
      label,
      patients: pts,
      completedCount: pts.filter(p => isRecordComplete(records[p.id], p)).length,
      totalCount: pts.length,
    }))
  }, [filteredPatients, records, groupBy])

  if (loading) return <div className="p-8 text-center text-slate-400">読み込み中...</div>

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">月次一括入力</h1>
          {monthClosed && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              <Lock className="h-3 w-3" /> 締め済み
            </span>
          )}
        </div>

        {/* 年月ナビゲーション */}
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <input
            type="month"
            value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}
            className="border border-slate-300 rounded-xl py-1.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button onClick={() => moveMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* フィルタ */}
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">すべて</option>
          <option value="incomplete">未完了のみ</option>
          <option value="fax">FAX必要のみ</option>
        </select>

        {/* グループ */}
        <select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="facility">施設別グループ</option>
          <option value="none">グループなし</option>
        </select>

        {/* 月次締めボタン */}
        <button
          onClick={handleClose}
          disabled={!allComplete || monthClosed}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-40 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" />
          {monthClosed ? '締め完了' : '月次締め'}
        </button>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 min-w-[160px]">患者名</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 min-w-[110px]">請求金額</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">請求書<br/>発行</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 min-w-[110px] whitespace-nowrap">請求書<br/>渡し</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">領収書<br/>発行</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 min-w-[110px] whitespace-nowrap">領収書<br/>渡し</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">FAX</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">入金確認</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">帳票</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(group => (
                <Fragment key={group.key}>
                  {group.label && (
                    <tr key={`g-${group.key}`} className="bg-slate-100 border-t border-slate-200">
                      <td colSpan={9} className="px-4 py-2 text-xs font-semibold text-slate-600">
                        {group.label}
                        <span className="ml-2 font-normal text-slate-400">
                          {group.completedCount}/{group.totalCount} 完了
                        </span>
                      </td>
                    </tr>
                  )}
                  {group.patients.map(patient => {
                    const record = records[patient.id]
                    if (!record) return null
                    const isSaving = savingRows.has(patient.id)
                    const isZeroAmount = record.billingAmount === '' || Number(record.billingAmount) === 0
                    const complete = isRecordComplete(record, patient)

                    return (
                      <tr
                        key={patient.id}
                        className={clsx(
                          'border-t border-slate-100 transition-colors',
                          complete ? 'bg-emerald-50/40' : isZeroAmount ? 'bg-slate-50' : 'hover:bg-blue-50/30',
                          isSaving && 'opacity-60'
                        )}
                      >
                        {/* 患者名 */}
                        <td className="px-4 py-2 sticky left-0 bg-inherit">
                          <div className="font-medium text-slate-800 text-sm">{patient.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {patient.isFacility ? (patient.facilityName || '施設') : '居宅'}
                          </div>
                        </td>

                        {/* 請求金額 */}
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            value={record.billingAmount}
                            onChange={e => handleAmountChange(patient.id, e.target.value)}
                            onBlur={() => handleAmountBlur(patient.id)}
                            disabled={monthClosed}
                            className="w-24 border border-slate-300 rounded-lg py-1 px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>

                        {/* 請求書 発行 */}
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!record.invoiceIssued}
                            onChange={e => handleChange(patient.id, 'invoiceIssued', e.target.checked)}
                            disabled={monthClosed}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                          />
                        </td>

                        {/* 請求書 渡し + 方法 */}
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="checkbox"
                              checked={!!record.invoiceDelivered}
                              onChange={e => handleChange(patient.id, 'invoiceDelivered', e.target.checked)}
                              disabled={monthClosed}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                            />
                            {record.invoiceDelivered && (
                              <select
                                value={record.invoiceDeliveryMethod || ''}
                                onChange={e => handleChange(patient.id, 'invoiceDeliveryMethod', e.target.value || null)}
                                disabled={monthClosed}
                                className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white focus:outline-none"
                              >
                                <option value="">方法</option>
                                {DELIVERY_METHODS.map(m => (
                                  <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* 領収書 発行 */}
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!record.receiptIssued}
                            onChange={e => handleChange(patient.id, 'receiptIssued', e.target.checked)}
                            disabled={monthClosed}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                          />
                        </td>

                        {/* 領収書 渡し + 方法 */}
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="checkbox"
                              checked={!!record.receiptDelivered}
                              onChange={e => handleChange(patient.id, 'receiptDelivered', e.target.checked)}
                              disabled={monthClosed}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                            />
                            {record.receiptDelivered && (
                              <select
                                value={record.receiptDeliveryMethod || ''}
                                onChange={e => handleChange(patient.id, 'receiptDeliveryMethod', e.target.value || null)}
                                disabled={monthClosed}
                                className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white focus:outline-none"
                              >
                                <option value="">方法</option>
                                {DELIVERY_METHODS.map(m => (
                                  <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* FAX（ケアマネあり患者のみ） */}
                        <td className="px-4 py-2 text-center">
                          {patient.hasCareManager ? (
                            <input
                              type="checkbox"
                              checked={!!record.faxSent}
                              onChange={e => handleChange(patient.id, 'faxSent', e.target.checked)}
                              disabled={monthClosed}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* 入金確認 */}
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!record.paymentReceived}
                            onChange={e => handleChange(patient.id, 'paymentReceived', e.target.checked)}
                            disabled={monthClosed}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 cursor-pointer"
                          />
                        </td>

                        {/* 帳票出力 */}
                        <td className="px-4 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <PdfExportButton type="receipt" patient={patient} record={record} />
                            {patient.hasCareManager && (
                              <PdfExportButton patient={patient} record={record} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPatients.length === 0 && !loading && (
          <div className="p-10 text-center text-slate-400">
            {patients.length === 0 ? '継続中の患者がいません' : '該当する患者がいません'}
          </div>
        )}
      </div>
    </div>
  )
}
