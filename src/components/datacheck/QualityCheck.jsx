// src/components/datacheck/QualityCheck.jsx
import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { runQualityChecks, CHECK_LABELS, CHECK_FIELDS, CHECK_INPUT_TYPES } from '../../utils/checkUtils'
import InlineEditCell from './InlineEditCell'
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

export default function QualityCheck() {
  const [patients, setPatients] = useState([])
  const [checks, setChecks] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAndCheck = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'patients'))
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPatients(data)
      setChecks(runQualityChecks(data))
    } catch (err) {
      console.error(err)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAndCheck() }, [fetchAndCheck])

  async function handleSave(patientId, field, value) {
    // NaN ガード: 数値変換できない入力は null として扱う
    const coerced = field === 'visitNumber'
      ? (value === '' ? null : (isNaN(Number(value)) ? null : Number(value)))
      : value
    await updateDoc(doc(db, 'patients', patientId), { [field]: coerced })
    // コールバック形式で常に最新の patients を参照する（stale closure 回避）
    setPatients(prev => {
      const updated = prev.map(p =>
        p.id === patientId ? { ...p, [field]: coerced } : p
      )
      setChecks(runQualityChecks(updated))
      return updated
    })
  }

  if (loading) return <div className="p-8 text-center text-slate-400">読み込み中...</div>

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-500 mb-3">{error}</p>
      <button onClick={fetchAndCheck} className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
        <RefreshCw className="h-4 w-4" />再試行
      </button>
    </div>
  )

  const totalIssues = Object.values(checks).reduce((sum, arr) => sum + arr.length, 0)

  if (totalIssues === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-emerald-600">
        <CheckCircle2 className="h-14 w-14 mb-4" />
        <p className="text-lg font-semibold">すべての項目が正常です</p>
        <button onClick={fetchAndCheck} className="mt-4 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />再チェック
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        問題のあるフィールドをクリックすると編集できます。保存後は自動で再チェックします。
      </p>
      {Object.entries(checks).map(([checkId, problemPatients]) => {
        if (problemPatients.length === 0) return null
        const field = CHECK_FIELDS[checkId]
        const inputType = CHECK_INPUT_TYPES[checkId]
        return (
          <section key={checkId} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <h3 className="font-semibold text-orange-800 text-sm">
                {CHECK_LABELS[checkId]}（{problemPatients.length}件）
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-600 font-medium w-14">No.</th>
                  <th className="text-left px-4 py-2 text-slate-600 font-medium w-40">患者名</th>
                  <th className="text-left px-4 py-2 text-slate-600 font-medium">値 / 修正（クリックで編集）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {problemPatients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-400 text-xs">{p.visitNumber ?? '—'}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-2">
                      <InlineEditCell
                        value={p[field] != null ? String(p[field]) : ''}
                        type={inputType}
                        onSave={v => handleSave(p.id, field, v)}
                        placeholder="クリックして設定"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
