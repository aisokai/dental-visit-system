import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 mt-0.5" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">画面表示で問題が発生しました</h1>
                <p className="mt-2 text-sm text-slate-600">
                  データの整合性を守るため、画面を安全停止しました。再読み込みして続行してください。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4" />
              再読み込み
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
