// src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { db } from '../firebase'
import { format, addMonths } from 'date-fns'
import { AlertTriangle, CheckCircle2, FileText, Banknote, Printer } from 'lucide-react'
import { clsx } from 'clsx'
import { getDaysUntilExpiry, getExpiryColorClass } from '../utils/patientUtils'
import { isRecordComplete } from '../utils/monthlyUtils'

export default function Dashboard() {
  const [patients, setPatients] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  // currentMonthStr はレンダリング中に固定する（useEffect 依存配列用）
  const currentMonthStr = format(new Date(), 'yyyy-MM')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // active患者と当月レコードを並列取得
        const [patientsSnap, recordsSnap] = await Promise.all([
          getDocs(query(collection(db, 'patients'), where('status', '==', 'active'))),
          getDocs(query(collection(db, 'monthly_records'), where('yearMonth', '==', currentMonthStr))),
        ])
        setPatients(patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setRecords(recordsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('ダッシュボードデータ読み込みエラー:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currentMonthStr])

  // 月次統計を計算（新フィールドベース）
  const monthlyStats = useMemo(() => {
    const recordMap = {}
    records.forEach(r => { recordMap[r.patientId] = r })

    let completed = 0
    let invoiceNotIssued = 0
    let faxNotSent = 0
    let paymentNotReceived = 0

    patients.forEach(p => {
      const r = recordMap[p.id]
      if (isRecordComplete(r, p)) {
        completed++
        return
      }
      if (!r?.invoiceIssued) invoiceNotIssued++
      if (p.hasCareManager && !r?.faxSent) faxNotSent++
      if (!r?.paymentReceived) paymentNotReceived++
    })

    return { total: patients.length, completed, invoiceNotIssued, faxNotSent, paymentNotReceived }
  }, [patients, records])

  // 介護保険切れ・2ヶ月以内の患者を残日数昇順に並べる
  const expiringPatients = useMemo(() => {
    const limit = addMonths(new Date(), 2)
    return patients
      .filter(p => {
        if (!p.insuranceExpiryDate) return false
        // "YYYY-MM" → その月の末日を期限とする
        const [y, m] = p.insuranceExpiryDate.split('-').map(Number)
        return new Date(y, m, 0) <= limit
      })
      .sort((a, b) => {
        const da = getDaysUntilExpiry(a.insuranceExpiryDate) ?? Infinity
        const db_ = getDaysUntilExpiry(b.insuranceExpiryDate) ?? Infinity
        return da - db_
      })
  }, [patients])

  // 当月の入金未確認患者（billingAmount が設定済みかつ paymentReceived=false）
  const unpaidRecords = useMemo(() => {
    const patientMap = {}
    patients.forEach(p => { patientMap[p.id] = p })
    return records
      .filter(r => !r.paymentReceived && r.billingAmount != null && Number(r.billingAmount) > 0)
      .map(r => ({ ...r, patient: patientMap[r.patientId] }))
      .filter(r => r.patient) // 患者が見つからないレコードは除外
  }, [patients, records])

  const progressPercent = monthlyStats.total > 0
    ? Math.round((monthlyStats.completed / monthlyStats.total) * 100)
    : 0

  if (loading) return <div className="p-8 text-center text-slate-400">読み込み中...</div>

  return (
    <div className="space-y-6">
      {/* 月次進捗カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* プログレスバー */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="font-semibold text-slate-700">{currentMonthStr} 月次進捗</h2>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {monthlyStats.completed}
              <span className="text-sm font-normal text-slate-500"> / {monthlyStats.total} 件</span>
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div
              className={clsx(
                'h-3 rounded-full transition-all duration-500',
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-right text-sm text-slate-500">{progressPercent}% 完了</p>
        </div>

        {/* 残タスク数 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">今月の残タスク</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <FileText className="h-4 w-4" /> 請求書未発行
            </span>
            <span className="font-bold text-slate-900">{monthlyStats.invoiceNotIssued} 件</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Printer className="h-4 w-4" /> FAX未送信
            </span>
            <span className="font-bold text-slate-900">{monthlyStats.faxNotSent} 件</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Banknote className="h-4 w-4" /> 入金未確認
            </span>
            <span className="font-bold text-slate-900">{monthlyStats.paymentNotReceived} 件</span>
          </div>
        </div>
      </div>

      {/* アラートパネル */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 介護保険切れ（間近含む） */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-orange-50 flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-orange-800">介護保険切れ（間近含む）</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {expiringPatients.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">該当する患者はいません</p>
            ) : (
              expiringPatients.map(p => {
                const days = getDaysUntilExpiry(p.insuranceExpiryDate)
                const colorClass = getExpiryColorClass(p.insuranceExpiryDate)
                return (
                  <div key={p.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.isFacility ? '施設' : '居宅'}</p>
                    </div>
                    <div className={clsx('text-right text-sm', colorClass)}>
                      <p>{p.insuranceExpiryDate}</p>
                      <p className="text-xs">
                        {days == null ? '' : days < 0 ? `${Math.abs(days)}日超過` : `残 ${days} 日`}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 入金未確認（当月） */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-red-50 flex items-center">
            <Banknote className="h-5 w-5 text-red-500 mr-2" />
            <h2 className="text-lg font-semibold text-red-800">入金未確認（当月）</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {unpaidRecords.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">入金未確認の患者はいません</p>
            ) : (
              unpaidRecords.map(r => (
                <div key={r.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900">{r.patient.name}</p>
                    <p className="text-sm text-slate-500">対象月: {r.yearMonth}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">¥{Number(r.billingAmount).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
