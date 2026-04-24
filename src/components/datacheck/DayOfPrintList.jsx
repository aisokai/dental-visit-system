// src/components/datacheck/DayOfPrintList.jsx
import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { Printer } from 'lucide-react'

export default function DayOfPrintList() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [facilityFilter, setFacilityFilter] = useState('all')

  useEffect(() => {
    async function fetchPatients() {
      try {
        const snap = await getDocs(
          query(collection(db, 'patients'), where('status', '==', 'active'))
        )
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        data.sort((a, b) => (a.visitNumber ?? Infinity) - (b.visitNumber ?? Infinity))
        setPatients(data)
      } catch (err) {
        console.error(err)
        setError('データの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [])

  if (loading) return <div className="p-8 text-center text-slate-400">読み込み中...</div>
  if (error) return <p className="text-red-500 p-8">{error}</p>

  // 施設フィルターの選択肢を生成
  const facilityNames = [...new Set(
    patients.filter(p => p.isFacility).map(p => p.facilityName || '施設')
  )].sort()
  const filterOptions = ['all', '居宅', ...facilityNames]

  const filtered = (() => {
    if (facilityFilter === 'all') return patients
    if (facilityFilter === '居宅') return patients.filter(p => !p.isFacility)
    return patients.filter(p => p.isFacility && p.facilityName === facilityFilter)
  })()

  return (
    <div>
      {/* コントロールバー（印刷時は非表示） */}
      <div className="flex items-center gap-4 mb-4 print:hidden">
        <select
          value={facilityFilter}
          onChange={e => setFacilityFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {filterOptions.map(f => (
            <option key={f} value={f}>
              {f === 'all' ? 'すべて' : f}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{filtered.length}件</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 transition-colors ml-auto"
        >
          <Printer className="h-4 w-4" />
          印刷
        </button>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print:shadow-none print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">No.</th>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">患者名</th>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">住所（訪問先）</th>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">介護度</th>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">ケアマネ名</th>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">ケアマネ電話</th>
              <th className="text-left px-3 py-2 text-slate-600 font-medium text-xs">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                  該当する患者がいません
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 print:hover:bg-white">
                  <td className="px-3 py-2 text-slate-400 text-xs">{p.visitNumber ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{p.addressVisit || p.addressKarte || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{p.careLevel || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{p.careManagerName || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{p.careManagerPhone || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{p.notes || ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
