// src/components/datacheck/VisitChecklist.jsx
import { useState } from 'react'
import MonthlyPrepCheck from './MonthlyPrepCheck'
import DayOfPrintList from './DayOfPrintList'

export default function VisitChecklist() {
  const [mode, setMode] = useState('monthly')

  return (
    <div className="space-y-4">
      {/* モード切替トグル */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setMode('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'monthly'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          月次準備チェック
        </button>
        <button
          onClick={() => setMode('dayof')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'dayof'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          当日確認リスト
        </button>
      </div>

      {mode === 'monthly' ? <MonthlyPrepCheck /> : <DayOfPrintList />}
    </div>
  )
}
