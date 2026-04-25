// src/pages/Patients.jsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Upload, Download, ChevronUp, ChevronDown, SlidersHorizontal, History } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  getInsuranceExpiryStatus,
  getDaysUntilExpiry,
  getStatusLabel,
  getCollectionMethodLabel,
  getStatusBadgeClass,
  getExpiryColorClass,
} from '../utils/patientUtils'
import { useToast } from '../context/ToastContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusChangeDialog } from '../components/StatusChangeDialog'
import { ChangelogModal } from '../components/ChangelogModal'
import { addChangelogEntry } from '../utils/changelogUtils'

const STATUS_OPTIONS = [
  { value: 'active', label: '継続中' },
  { value: 'suspended', label: '中断中' },
  { value: 'ended', label: '終了' },
  { value: 'deceased', label: '逝去' },
]

const ALL_COLUMNS = [
  { key: 'visitNumber', label: 'No.', sortable: true },
  { key: 'chartNumber', label: 'カルテ番号', sortable: true },
  { key: 'name', label: '氏名', sortable: true },
  { key: 'facilityName', label: '施設 / 居宅', sortable: true },
  { key: 'careLevel', label: '介護度', sortable: true },
  { key: 'insuranceExpiryDate', label: '介護期限', sortable: true },
  { key: 'firstVisitDate', label: '初診日', sortable: true },
  { key: 'collectionMethod', label: '回収方法', sortable: true },
  { key: 'hasCareManager', label: 'CM', sortable: false },
  { key: 'status', label: 'ステータス', sortable: true },
]

export default function Patients() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const colMenuRef = useRef(null)

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [groupBy, setGroupBy] = useState('none')
  const [sortKey, setSortKey] = useState('visitNumber')
  const [sortDir, setSortDir] = useState('asc')
  const [visibleCols, setVisibleCols] = useState(new Set(ALL_COLUMNS.map(c => c.key)))
  const [showColMenu, setShowColMenu] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [statusDialog, setStatusDialog] = useState(null) // { patient, newStatus }
  const [changelogPatient, setChangelogPatient] = useState(null)
    const handleDownloadTemplate = () => {
    const headers = [[
      'No.',
      'カルテ番号',
      '氏名',
      '施設 / 居宅',
      '介護度',
      '介護期限',
      '初診日',
      '回収方法',
      'CM',
      'ステータス',
    ]]

    const ws = XLSX.utils.aoa_to_sheet(headers)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '患者管理')
    XLSX.writeFile(wb, '患者管理テンプレート.xlsx')
  }

  // カラムメニュー外クリックで閉じる
  useEffect(() => {
    const handler = e => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    getDocs(query(collection(db, 'patients'), orderBy('name')))
      .then(snap => setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => addToast({ message: '患者データの読み込みに失敗しました', type: 'error' }))
      .finally(() => setLoading(false))
  }, [addToast])

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleStatusChange = (patient, newStatus) => {
    // すべてのステータス変更をダイアログで処理（画面遷移なし）
    setStatusDialog({ patient, newStatus })
  }

  const handleStatusConfirm = async ({ statusDate, statusReason, staffName }) => {
    // Capture statusDialog before any awaits to avoid stale closure
    const currentDialog = statusDialog
    if (!currentDialog) return
    const { patient, newStatus } = currentDialog
    const oldStatus = patient.status ?? 'active'
    await updateDoc(doc(db, 'patients', patient.id), {
      status: newStatus,
      statusDate: statusDate || '',
      statusReason: statusReason || '',
      updatedAt: serverTimestamp(),
    })
    // ステータス関連フィールドの変更を changelog に記録
    // Only add status entry if status actually changed
    const changes = []
    if (oldStatus !== newStatus) {
      changes.push({ field: 'status', label: 'ステータス', oldValue: getStatusLabel(oldStatus), newValue: getStatusLabel(newStatus) })
    }
    if (statusDate) {
      changes.push({ field: 'statusDate', label: 'ステータス変更日', oldValue: patient.statusDate || '', newValue: statusDate })
    }
    if (statusReason) {
      changes.push({ field: 'statusReason', label: 'ステータス変更理由', oldValue: patient.statusReason || '', newValue: statusReason })
    }
    // Only write changelog if there are actual changes
    if (changes.length > 0) {
      try {
        await addChangelogEntry(patient.id, staffName, changes)
      } catch (err) {
        console.error('changelog write failed:', err)
        addToast({ message: '変更ログの記録に失敗しました', type: 'error' })
      }
    }
    setPatients(prev => prev.map(p =>
      p.id === patient.id ? { ...p, status: newStatus, statusDate, statusReason } : p
    ))
    addToast({ message: 'ステータスを更新しました', type: 'success' })
    setStatusDialog(null)
  }

  const filtered = useMemo(() => {
    let list = patients.filter(p => {
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      const q = searchQuery.toLowerCase()
      const matchSearch = !q || [p.name, p.facilityName, p.chartNumber].some(v => v?.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })

    return [...list].sort((a, b) => {
      if (sortKey === 'insuranceExpiryDate') {
        const da = getDaysUntilExpiry(a.insuranceExpiryDate) ?? 99999
        const db2 = getDaysUntilExpiry(b.insuranceExpiryDate) ?? 99999
        return sortDir === 'asc' ? da - db2 : db2 - da
      }
      if (sortKey === 'visitNumber') {
        // null は末尾
        const na = a.visitNumber ?? Infinity
        const nb = b.visitNumber ?? Infinity
        return sortDir === 'asc' ? na - nb : nb - na
      }
      if (sortKey === 'firstVisitDate') {
        // 空文字・null は末尾
        const fa = a.firstVisitDate || 'ZZZZ'
        const fb = b.firstVisitDate || 'ZZZZ'
        return sortDir === 'asc' ? fa.localeCompare(fb) : fb.localeCompare(fa)
      }
      let va = sortKey === 'collectionMethod' ? getCollectionMethodLabel(a[sortKey]) : (a[sortKey] ?? '')
      let vb = sortKey === 'collectionMethod' ? getCollectionMethodLabel(b[sortKey]) : (b[sortKey] ?? '')
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'ja')
        : String(vb).localeCompare(String(va), 'ja')
    })
  }, [patients, statusFilter, searchQuery, sortKey, sortDir])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, patients: filtered }]
    const map = new Map()
    filtered.forEach(p => {
      const key = groupBy === 'facility'
        ? (p.isFacility ? (p.facilityName || '施設（名称未設定）') : '居宅')
        : getCollectionMethodLabel(p.collectionMethod)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    })
    return [...map.entries()].map(([label, patients]) => ({ key: label, label, patients }))
  }, [filtered, groupBy])

  const SortIcon = ({ col }) => sortKey === col
    ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />)
    : null

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="氏名・施設名・カルテ番号で検索"
            className="pl-9 pr-3 py-2 w-full border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4 text-slate-500" />
          Excelテンプレート
        </button>
        <select
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">すべてのステータス</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={groupBy}
          onChange={e => setGroupBy(e.target.value)}
        >
          <option value="none">グループなし</option>
          <option value="facility">施設別</option>
          <option value="collectionMethod">回収方法別</option>
        </select>

        <div className="relative" ref={colMenuRef}>
          <button
            onClick={() => setShowColMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-500" /> 列
          </button>
          {showColMenu && (
            <div className="absolute top-11 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-20 min-w-[180px] space-y-1.5">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.key)}
                    onChange={e => {
                      const next = new Set(visibleCols)
                      e.target.checked ? next.add(col.key) : next.delete(col.key)
                      setVisibleCols(next)
                    }}
                    className="rounded border-slate-300"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex gap-2">
          <Link
            to="/patients/import"
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white hover:bg-slate-50 transition-colors"
          >
            <Upload className="h-4 w-4 text-slate-500" /> インポート
          </Link>
          <Link
            to="/patients/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" /> 新規登録
          </Link>
        </div>
      </div>

      {/* 件数表示 */}
      <p className="text-xs text-slate-400">{filtered.length}名表示中</p>

      {/* テーブル */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">該当する患者がいません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {ALL_COLUMNS.filter(c => visibleCols.has(c.key)).map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {col.sortable ? (
                        <button onClick={() => handleSort(col.key)} className="flex items-center hover:text-slate-800 transition-colors">
                          {col.label}<SortIcon col={col.key} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => (
                  <>
                    {group.label && (
                      <tr key={`g-${group.key}`} className="bg-slate-100 border-t border-slate-200">
                        <td colSpan={visibleCols.size + 1} className="px-4 py-2 text-xs font-semibold text-slate-600">
                          {group.label}　<span className="font-normal text-slate-400">{group.patients.length}名</span>
                        </td>
                      </tr>
                    )}
                    {group.patients.map(p => (
                      <tr
                        key={p.id}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/patients/${p.id}`)}
                      >
                        {visibleCols.has('visitNumber') && (
                          <td className="px-4 py-3 text-sm">
                            {p.visitNumber != null
                              ? <span className="font-mono font-semibold text-blue-700">No.{p.visitNumber}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        )}
                        {visibleCols.has('chartNumber') && <td className="px-4 py-3 text-slate-400 text-xs">{p.chartNumber || '—'}</td>}
                        {visibleCols.has('name') && <td className="px-4 py-3 font-medium text-blue-600">{p.name}</td>}
                        {visibleCols.has('facilityName') && <td className="px-4 py-3 text-slate-600">{p.isFacility ? (p.facilityName || '施設') : '居宅'}</td>}
                        {visibleCols.has('careLevel') && <td className="px-4 py-3 text-slate-600">{p.careLevel || '—'}</td>}
                        {visibleCols.has('insuranceExpiryDate') && (
                          <td className={`px-4 py-3 ${getExpiryColorClass(p.insuranceExpiryDate)}`}>
                            {p.insuranceExpiryDate || '—'}
                            {getInsuranceExpiryStatus(p.insuranceExpiryDate) === 'expired' && ' ⚠'}
                            {getInsuranceExpiryStatus(p.insuranceExpiryDate) === 'warning' && ' !'}
                          </td>
                        )}
                        {visibleCols.has('firstVisitDate') && (
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {p.firstVisitDate || '—'}
                          </td>
                        )}
                        {visibleCols.has('collectionMethod') && <td className="px-4 py-3 text-slate-600">{getCollectionMethodLabel(p.collectionMethod)}</td>}
                        {visibleCols.has('hasCareManager') && <td className="px-4 py-3 text-center text-slate-500">{p.hasCareManager ? '✓' : '—'}</td>}
                        {visibleCols.has('status') && (
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <select
                              value={p.status || 'active'}
                              onChange={e => handleStatusChange(p, e.target.value)}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 cursor-pointer ${getStatusBadgeClass(p.status)}`}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => setChangelogPatient(p)}
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                              title="変更ログを確認"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            <Link
                              to={`/patients/${p.id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              編集
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={confirmDialog?.onCancel}
      />

      <StatusChangeDialog
        open={!!statusDialog}
        patient={statusDialog?.patient}
        newStatus={statusDialog?.newStatus}
        onConfirm={handleStatusConfirm}
        onCancel={() => setStatusDialog(null)}
      />

      <ChangelogModal
        open={!!changelogPatient}
        patient={changelogPatient}
        onClose={() => setChangelogPatient(null)}
      />
    </div>
  )
}
