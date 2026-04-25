import { useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  LifeBuoy,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

const helpSections = [
  {
    id: 'daily-start',
    category: '受付スタッフ',
    title: '毎朝の開始チェック（3分）',
    description: '診療前にアプリの基本動作を確認し、当日の受付対応を安定させます。',
    icon: ShieldCheck,
    tone: 'blue',
    items: [
      {
        title: 'ログイン確認',
        detail:
          'ブラウザで https://dental-visit-system.web.app を開き、Google アカウントでサインインできることを確認します。複数アカウント利用時は業務用アカウントを選択してください。',
        tags: ['ログイン', 'Google', '開始前'],
      },
      {
        title: '主要画面の表示確認',
        detail:
          '患者管理・月次一括入力・データチェック・ヘルプの4画面に順番に遷移し、白画面やエラー表示が出ないことを確認します。',
        tags: ['患者管理', '月次一括入力', 'データチェック', 'ヘルプ'],
      },
      {
        title: '当日運用の準備',
        detail:
          '必要に応じて患者一覧を開き、本日の訪問予定に該当する患者データが参照できることを確認します。',
        tags: ['患者一覧', '訪問予定', '準備'],
      },
    ],
  },
  {
    id: 'operation-flow',
    category: '受付スタッフ',
    title: '通常業務の操作フロー',
    description: '日中の主要業務を画面ごとに手順化しています。',
    icon: BookOpenCheck,
    tone: 'green',
    items: [
      {
        title: '患者情報を更新する',
        detail:
          '患者管理で対象患者を開き、必要項目を編集して保存します。保存後に一覧へ戻り、再度患者詳細を開いて更新内容が反映されていることを確認します。',
        tags: ['患者管理', '編集', '保存'],
      },
      {
        title: '月次一括入力を実行する',
        detail:
          '月次一括入力画面で対象年月を選択し、該当項目を入力後に保存します。保存後に画面を再表示し、同じ年月で値が保持されていることを確認します。',
        tags: ['月次一括入力', '年月', '保存確認'],
      },
      {
        title: 'データチェックを実施する',
        detail:
          'データチェック画面で各タブを切り替え、差分・不足・整合性の確認を行います。必要に応じて対象データを修正後、再チェックして解消状態を確認します。',
        tags: ['データチェック', 'タブ', '差分確認'],
      },
    ],
  },
  {
    id: 'trouble-shooting',
    category: '一次対応',
    title: 'トラブル時の一次対応',
    description: 'よくある問題の切り分け手順です。再発防止のため記録も残してください。',
    icon: AlertCircle,
    tone: 'amber',
    items: [
      {
        title: '画面が真っ白・動かない',
        detail:
          'Cmd + Shift + R（Windows は Ctrl + Shift + R）で強制再読み込みしてください。改善しない場合は一度ログアウトして再ログインし、発生時刻を記録します。',
        tags: ['白画面', '再読み込み', '再ログイン'],
      },
      {
        title: 'ログインできない',
        detail:
          'Google アカウント選択を見直し、不要タブを閉じて再試行します。失敗時は表示エラーメッセージをスクリーンショットで保存し、管理者へ共有してください。',
        tags: ['ログイン失敗', 'Google', 'エラー'],
      },
      {
        title: '保存できない',
        detail:
          'ネットワーク接続を確認し、30秒ほど待って再保存します。改善しない場合は日時・患者名・実施操作を記録して管理者へ連絡してください。',
        tags: ['保存失敗', '通信', '管理者連絡'],
      },
    ],
  },
  {
    id: 'admin-workflow',
    category: '管理者',
    title: '管理者向けの更新ワークフロー',
    description: '更新時に最低限実施する確認手順です。',
    icon: Wrench,
    tone: 'slate',
    items: [
      {
        title: '変更内容をローカル確認',
        detail:
          '画面の主要導線（患者管理、月次一括入力、データチェック、ヘルプ）を実際に操作し、UI崩れや保存不具合がないことを確認します。',
        tags: ['ローカル確認', '回帰確認', 'UI'],
      },
      {
        title: '静的解析とテスト',
        detail:
          'npm run lint / npm run test:run / npm run check を実行し、失敗がない状態でコミットしてください。必要に応じて npm run audit も実行します。',
        tags: ['lint', 'test', 'check', 'audit'],
      },
      {
        title: '運用共有',
        detail:
          '仕様変更がある場合は、影響する操作手順と対応タイミングを受付スタッフへ共有し、ヘルプページの内容も同期してください。',
        tags: ['仕様変更', '運用連携', 'ヘルプ更新'],
      },
    ],
  },
]

function HelpCard({ section, query }) {
  const toneClass = {
    slate: 'border-slate-200 bg-white',
    blue: 'border-blue-200 bg-blue-50/30',
    green: 'border-emerald-200 bg-emerald-50/30',
    amber: 'border-amber-200 bg-amber-50/40',
  }[section.tone]

  return (
    <section className={`rounded-2xl border p-5 space-y-3 ${toneClass}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <section.icon className="h-5 w-5" />
        {section.title}
      </h2>
      <p className="text-sm text-slate-600">{section.description}</p>

      <ul className="space-y-3 text-sm text-slate-700">
        {section.items.map(item => {
          const shouldHighlight =
            query.length > 0 &&
            `${item.title} ${item.detail} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())

          return (
            <li key={item.title} className="rounded-xl bg-white/80 border border-white/60 p-3 space-y-2">
              <p className="font-medium text-slate-900 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                {item.title}
              </p>
              <p>{item.detail}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map(tag => (
                  <span
                    key={tag}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      shouldHighlight ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Help() {
  const [query, setQuery] = useState('')

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return helpSections

    return helpSections
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          `${section.title} ${section.description} ${item.title} ${item.detail} ${item.tags.join(' ')}`
            .toLowerCase()
            .includes(normalizedQuery)
        ),
      }))
      .filter(section => section.items.length > 0)
  }, [query])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-blue-600" />
          ヘルプ
        </h1>
        <p className="text-sm text-slate-600">
          操作方法・仕様・運用ワークフローを検索できます。キーワード（例: 保存 / ログイン / データチェック）で絞り込みしてください。
        </p>
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="項目を検索（例: 保存 / ログイン / 管理者）"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      {filteredSections.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          「{query}」に一致するヘルプ項目は見つかりませんでした。別のキーワードで検索してください。
        </section>
      ) : (
        <div className="space-y-4">
          {filteredSections.map(section => (
            <HelpCard key={section.id} section={section} query={query.trim().toLowerCase()} />
          ))}
        </div>
      )}
    </div>
  )
}
