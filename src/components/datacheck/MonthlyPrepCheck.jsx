// src/components/datacheck/MonthlyPrepCheck.jsx
import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { getDaysUntilExpiry, getExpiryColorClass } from '../../utils/patientUtils'
import InlineEditCell from './InlineEditCell'
import { RefreshCw } from 'lucide-react'
import { addChangelogEntry, FIELD_LABELS } from '../../utils/changelogUtils'

export default function MonthlyPrepCheck() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(
        query(collection(db, 'patients'), where('status', '==', 'active'))
      )
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // 訪問登録番号昇順（未設定は末尾）
      data.sort((a, b) => (a.visitNumber ?? Infinity) - (b.visitNumber ?? Infinity))
      setPatients(data)
    } catch (err) {
      console.error(err)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  async function handleSave(patientId, field, value, staffName) {
    // 変更前の値をキャプチャ（changelog に記録するため）
    const oldValue = String(patients.find(p => p.id === patientId)?.[field] ?? '')
    const newValue = String(value)
    await updateDoc(doc(db, 'patients', patientId), { [field]: value })
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, [field]: value } : p))
    // 実際に値が変更された場合のみ changelog に記録
    if (oldValue !== newValue) {
      try {
        await addChangelogEntry(patientId, staffName, [{
          field,
          label: FIELD_LABELS[field] ?? field,
          oldValue,
          newValue,
        }])
      } catch (err) {
        console.error('changelog write failed:', err)
      }
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">読み込み中...</div>

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-500 mb-3">{error}</p>
      <button onClick={fetchPatients} className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
        <RefreshCw className="h-4 w-4" />再試行
      </button>
    </div>
  )

  if (patients.length === 0) {
    return <div className="p-8 text-center text-slate-400">患者データがありません</div>
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">No.</th>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">患者名</th>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">種別</th>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">介護保険期限</th>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">介護度</th>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">ケアマネFAX</th>
              <th className="text-left px-3 py-2.5 text-slate-600 font-medium text-xs whitespace-nowrap">訪問スケジュール</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map(p => {
              const expiryColor = getExpiryColorClass(p.insuranceExpiryDate)
              const days = getDaysUntilExpiry(p.insuranceExpiryDate)
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400 text-xs">{p.visitNumber ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                    {p.isFacility ? (p.facilityName || '施設') : '居宅'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.hasLongTermCareInsurance ? (
                      <InlineEditCell
                        value={p.insuranceExpiryDate || ''}
                        type="month"
                        onSave={(v, staffName) => handleSave(p.id, 'insuranceExpiryDate', v, staffName)}
                        placeholder="未設定"
                        // 設定済みの場合はカラークラスで表示値を色付けする
                        displayClassName={p.insuranceExpiryDate ? expiryColor : undefined}
                        displaySuffix={p.insuranceExpiryDate && days != null
                          ? (days < 0 ? `　${Math.abs(days)}日超過` : `　残${days}日`)
                          : undefined
                        }
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <InlineEditCell
                      value={p.careLevel || ''}
                      type="text"
                      onSave={(v, staffName) => handleSave(p.id, 'careLevel', v, staffName)}
                      placeholder="未入力"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.hasCareManager ? (
                      <InlineEditCell
                        value={p.careManagerFax || ''}
                        type="text"
                        onSave={(v, staffName) => handleSave(p.id, 'careManagerFax', v, staffName)}
                        placeholder="未設定"
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <InlineEditCell
                      value={p.visitSchedule || ''}
                      type="text"
                      onSave={(v, staffName) => handleSave(p.id, 'visitSchedule', v, staffName)}
                      placeholder="未設定"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
