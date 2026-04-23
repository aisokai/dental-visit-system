// src/pages/ImportPatients.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import * as XLSX from 'xlsx'
import { parsePatientSheet } from '../utils/importMapping'
import { getCollectionMethodLabel, getStatusLabel } from '../utils/patientUtils'
import { useToast } from '../context/ToastContext'
import { Upload, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function ImportPatients() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [step, setStep] = useState('upload') // 'upload' | 'preview' | 'importing' | 'done'
  const [previewPatients, setPreviewPatients] = useState([])
  const [parseErrors, setParseErrors] = useState([])
  const [duplicates, setDuplicates] = useState(new Set())
  const [importResult, setImportResult] = useState(null)

  const handleFile = async e => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets['患者管理']
      if (!ws) {
        addToast({ message: '「患者管理」シートが見つかりません', type: 'error' })
        return
      }
      const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const { patients, errors } = parsePatientSheet(sheetData)
      setPreviewPatients(patients)
      setParseErrors(errors)

      // 既存患者と重複チェック（氏名で照合）
      const existingSnap = await getDocs(collection(db, 'patients'))
      const existingNames = new Set(existingSnap.docs.map(d => d.data().name?.trim()))
      setDuplicates(new Set(patients.filter(p => existingNames.has(p.name)).map(p => p.name)))
      setStep('preview')
    } catch (err) {
      addToast({ message: `ファイルの読み込みに失敗しました: ${err.message}`, type: 'error' })
    }
  }

  const handleImport = async () => {
    setStep('importing')
    let success = 0, skipped = 0, errors = 0
    for (const patient of previewPatients) {
      if (duplicates.has(patient.name)) { skipped++; continue }
      try {
        await addDoc(collection(db, 'patients'), {
          ...patient,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        success++
      } catch (err) {
        console.error('患者インポートエラー:', err)
        errors++
      }
    }
    setImportResult({ success, skipped, errors })
    setStep('done')
  }

  const newCount = previewPatients.length - duplicates.size

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/patients')} className="flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="mr-1 h-4 w-4" />戻る
        </button>
        <h1 className="text-2xl font-bold text-slate-900">患者データ インポート</h1>
      </div>

      {/* Step 1: ファイル選択 */}
      {step === 'upload' && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center space-y-4">
          <Upload className="mx-auto h-12 w-12 text-slate-300" />
          <div>
            <p className="text-slate-700 font-medium">「三谷ファミリー歯科クリニック 訪問歯科診療リスト.xlsx」を選択</p>
            <p className="text-sm text-slate-400 mt-1">「患者管理」シートのデータを自動的に読み込みます</p>
          </div>
          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 cursor-pointer transition-colors">
            <Upload className="h-4 w-4" />ファイルを選択
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}

      {/* Step 2: プレビュー */}
      {step === 'preview' && (
        <div className="space-y-4">
          {parseErrors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-800">解析エラー（{parseErrors.length}件）</p>
              <ul className="mt-1.5 text-xs text-orange-700 space-y-0.5 list-disc list-inside">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {duplicates.size > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">重複患者 {duplicates.size}名 が見つかりました</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  以下の患者はすでに登録済みのためスキップされます：{[...duplicates].join('、')}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{previewPatients.length}名</span>を読み込みました
                （新規登録: <span className="font-semibold text-blue-600">{newCount}名</span>、スキップ: {duplicates.size}名）
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('upload'); setPreviewPatients([]); setParseErrors([]); setDuplicates(new Set()) }}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={newCount === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {newCount}名を登録する
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['カルテ番号', '氏名', '施設 / 居宅', '回収方法', 'CM', 'ステータス', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewPatients.map((p, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${duplicates.has(p.name) ? 'opacity-40' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{p.chartNumber || '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.isFacility ? p.facilityName : '居宅'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{getCollectionMethodLabel(p.collectionMethod)}</td>
                      <td className="px-4 py-2.5 text-center text-slate-500">{p.hasCareManager ? '✓' : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{getStatusLabel(p.status)}</td>
                      <td className="px-4 py-2.5 text-xs text-yellow-600">{duplicates.has(p.name) ? 'スキップ' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 処理中 */}
      {step === 'importing' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-400">
          登録中です。しばらくお待ちください...
        </div>
      )}

      {/* Step 4: 完了 */}
      {step === 'done' && importResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-6">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h2 className="text-xl font-semibold text-slate-900">インポート完了</h2>
          <div className="flex justify-center gap-10">
            <div>
              <p className="text-3xl font-bold text-emerald-600">{importResult.success}</p>
              <p className="text-sm text-slate-500 mt-1">登録成功</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-yellow-500">{importResult.skipped}</p>
              <p className="text-sm text-slate-500 mt-1">スキップ</p>
            </div>
            {importResult.errors > 0 && (
              <div>
                <p className="text-3xl font-bold text-red-500">{importResult.errors}</p>
                <p className="text-sm text-slate-500 mt-1">エラー</p>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/patients')}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            患者一覧へ
          </button>
        </div>
      )}
    </div>
  )
}
