// src/components/datacheck/ExcelDiff.jsx
import { useState, useRef } from 'react'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { parseExcelDate, computeDiff } from '../../utils/excelDiffUtils'
import { Upload, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ExcelDiff() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState(new Set())
  const inputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    // ファイルサイズ上限チェック（20MB超はFirestore/Excelパースで問題が起きるため弾く）
    if (file.size > 20 * 1024 * 1024) {
      setError('ファイルサイズが大きすぎます（20MB以下にしてください）')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      // ブラウザでExcelを解析
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets['患者管理']
      if (!ws) throw new Error('「患者管理」シートが見つかりません')
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      const excelPatients = []
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        const name = String(r[7] ?? '').trim()
        if (!name) continue
        excelPatients.push({
          name,
          firstVisitDate: parseExcelDate(r[11]),
        })
      }

      // Firestore から全患者取得
      const snap = await getDocs(collection(db, 'patients'))
      const firestorePatients = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      setResult(computeDiff(excelPatients, firestorePatients))
    } catch (err) {
      setError(err.message || 'ファイルの読み込みに失敗しました')
    } finally {
      setLoading(false)
      // refを使って安全にリセット（e.target はfinallyでは無効になっている場合がある）
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleApply(firestoreId, diffs) {
    // 二重押し防止：すでに処理中の場合は早期リターン
    if (applying.has(firestoreId)) return
    setApplying(prev => new Set([...prev, firestoreId]))
    const patch = {}
    diffs.forEach(d => { patch[d.field] = d.excelValue })
    try {
      await updateDoc(doc(db, 'patients', firestoreId), patch)
      // 適用済みの行を除外
      setResult(prev => ({
        ...prev,
        mismatched: prev.mismatched.filter(m => m.firestoreId !== firestoreId),
      }))
    } catch (err) {
      setError('Firestoreへの書き込みに失敗しました。再試行してください。')
    } finally {
      // 処理完了後は applying セットから削除してボタンを再度有効化
      setApplying(prev => {
        const next = new Set(prev)
        next.delete(firestoreId)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* ファイル選択エリア */}
      <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
        <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm text-slate-600 mb-4">
          訪問歯科診療リスト.xlsx を選択して、Firestoreとの差分を確認します
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            disabled={loading}
            ref={inputRef}
          />
          <span className={`inline-block px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
            {loading ? '比較中...' : 'Excelファイルを選択'}
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {result && (() => {
        const hasAny = result.excelOnly.length > 0 || result.firestoreOnly.length > 0 || result.mismatched.length > 0
        if (!hasAny) return (
          <div className="flex flex-col items-center justify-center py-16 text-emerald-600">
            <CheckCircle2 className="h-12 w-12 mb-3" />
            <p className="text-lg font-semibold">差分なし — データは一致しています</p>
          </div>
        )
        return (
          <>
            {result.excelOnly.length > 0 && (
              <DiffSection title="Excelのみ（Firestoreに未登録の可能性）" count={result.excelOnly.length} color="orange">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">患者名</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">Excel記載の初診日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.excelOnly.map((p, i) => (
                    <tr key={p.name} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-2 text-slate-500 text-sm">{p.firstVisitDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DiffSection>
            )}

            {result.firestoreOnly.length > 0 && (
              <DiffSection title="Firestoreのみ（Excelに記載なし）" count={result.firestoreOnly.length} color="slate">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">患者名</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">Firestoreの初診日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.firestoreOnly.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-2 text-slate-500 text-sm">{p.firstVisitDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DiffSection>
            )}

            {result.mismatched.length > 0 && (
              <DiffSection title="値の不一致（Excelで上書き可）" count={result.mismatched.length} color="red">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">患者名</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">差分</th>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium text-xs">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.mismatched.map(m => (
                    <tr key={m.firestoreId} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{m.name}</td>
                      <td className="px-4 py-2">
                        {m.diffs.map(d => (
                          <div key={d.field} className="text-xs">
                            <span className="text-slate-500 mr-1">{d.field}:</span>
                            <span className="line-through text-red-400">{d.firestoreValue || '（未設定）'}</span>
                            <span className="mx-1 text-slate-400">→</span>
                            <span className="text-emerald-600 font-medium">{d.excelValue}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleApply(m.firestoreId, m.diffs)}
                          disabled={applying.has(m.firestoreId)}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {applying.has(m.firestoreId) ? '反映中...' : 'Firestoreに反映'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DiffSection>
            )}
          </>
        )
      })()}
    </div>
  )
}

function DiffSection({ title, count, color, children }) {
  const headerColors = {
    orange: 'bg-orange-50 border-orange-100 text-orange-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    red: 'bg-red-50 border-red-100 text-red-800',
  }
  // 未知の color が渡された場合は slate にフォールバック
  const headerClass = headerColors[color] ?? headerColors.slate
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className={`px-5 py-3 border-b font-semibold text-sm ${headerClass}`}>
        {title}（{count}件）
      </div>
      <table className="w-full text-sm">{children}</table>
    </section>
  )
}
