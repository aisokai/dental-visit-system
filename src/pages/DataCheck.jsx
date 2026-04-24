import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, FileSpreadsheet, ClipboardList } from 'lucide-react'
import { clsx } from 'clsx'
import QualityCheck from '../components/datacheck/QualityCheck'
import ExcelDiff from '../components/datacheck/ExcelDiff'
import VisitChecklist from '../components/datacheck/VisitChecklist'

const TABS = [
  { id: 'quality', label: 'データ品質チェック', icon: ShieldCheck },
  { id: 'excel', label: 'Excel突合', icon: FileSpreadsheet },
  { id: 'checklist', label: '訪問前チェックリスト', icon: ClipboardList },
]

function isValidTab(tabId) {
  return TABS.some(tab => tab.id === tabId)
}

export default function DataCheck() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTabParam = searchParams.get('tab')

  const activeTab = useMemo(() => {
    if (isValidTab(activeTabParam)) return activeTabParam
    return 'quality'
  }, [activeTabParam])

  const handleChangeTab = (tabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tabId)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="データチェック切替"
        className="flex gap-1 border-b border-slate-200 overflow-x-auto pb-1 print:hidden"
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleChangeTab(tab.id)}
            className={clsx(
              'shrink-0 flex items-center gap-2 px-3 sm:px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'quality' && <QualityCheck />}
      {activeTab === 'excel' && <ExcelDiff />}
      {activeTab === 'checklist' && <VisitChecklist />}
    </div>
  )
}
