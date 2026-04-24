// src/pages/DataCheck.jsx
import { useState } from 'react'
import { ShieldCheck, FileSpreadsheet, ClipboardList } from 'lucide-react'
import { clsx } from 'clsx'
import QualityCheck from '../components/datacheck/QualityCheck'
import ExcelDiff from '../components/datacheck/ExcelDiff'
import VisitChecklist from '../components/datacheck/VisitChecklist'

const TABS = [
  { id: 'quality',    label: 'データ品質チェック',  icon: ShieldCheck },
  { id: 'excel',      label: 'Excel突合',           icon: FileSpreadsheet },
  { id: 'checklist',  label: '訪問前チェックリスト', icon: ClipboardList },
]

export default function DataCheck() {
  const [activeTab, setActiveTab] = useState('quality')

  return (
    <div className="space-y-6">
      {/* タブナビゲーション */}
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
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
