import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Library, RotateCcw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Inkling] Error boundary caught runtime error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleBackToShelf = () => {
    this.setState({ hasError: false, error: null })
    try {
      // Clear active book preference so it boots to shelf
      const raw = localStorage.getItem('inkling_prefs')
      if (raw) {
        const p = JSON.parse(raw)
        p.lastBook = null
        localStorage.setItem('inkling_prefs', JSON.stringify(p))
      }
    } catch {
      // ignore
    }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
          <div className="grain w-full max-w-md rounded border border-line bg-card p-8 shadow-2xl">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
              <AlertTriangle size={24} strokeWidth={1.8} />
            </div>

            <h2 className="font-serif text-2xl font-medium text-ink">
              Book Restoration Failed
            </h2>

            <p className="mt-2 font-serif text-sm italic text-soft">
              “The pages of this volume could not be bound cleanly into the margin engine.”
            </p>

            <div className="mt-4 rounded bg-paper/60 p-3 text-left font-mono text-xs text-soft border border-line overflow-x-auto">
              {this.state.error?.message || 'Unknown parser exception'}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleBackToShelf}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded bg-ink px-4 py-2 font-serif text-sm text-paper shadow-sm transition hover:opacity-90"
              >
                <Library size={16} />
                <span>Return to Bookshelf</span>
              </button>

              <button
                onClick={this.handleReset}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded border border-line px-4 py-2 font-serif text-sm text-soft transition hover:bg-paper hover:text-ink"
              >
                <RotateCcw size={15} />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
