import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { useStore } from './store.ts'
import { Bookshelf } from './components/Bookshelf.tsx'
import { Reader } from './components/Reader.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const THEME_COLOR = { cream: '#F9F6EE', parchment: '#F4EFEA', sage: '#EAEFE9', midnight: '#181615' }

export function App() {
  const ready = useStore((s) => s.ready)
  const open = useStore((s) => !!s.book)
  const theme = useStore((s) => s.prefs.theme)
  const deletedStash = useStore((s) => s.deletedStash)
  const { undoRemoveBook, commitRemoveBook } = useStore.getState()
  const [secondsLeft, setSecondsLeft] = useState(5)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  // 5-second countdown ticker for deletion undo toast
  useEffect(() => {
    if (!deletedStash) return
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((deletedStash.expiresAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 250)
    return () => window.clearInterval(timer)
  }, [deletedStash])

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center font-serif text-xl italic text-soft">
        <p className="animate-pulse">Opening the library…</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {open ? <Reader /> : <Bookshelf />}

      {/* Undo Cascade Deletion Snackbar */}
      {deletedStash && (
        <aside
          role="status"
          aria-live="polite"
          className="grain fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded border border-line bg-card px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
        >
          <span className="font-serif text-sm text-ink">
            “{deletedStash.book.title}” removed from library.
          </span>
          <button
            onClick={() => void undoRemoveBook()}
            className="flex items-center gap-1.5 rounded bg-ink px-3 py-1 font-serif text-xs text-paper shadow-xs transition hover:opacity-90"
          >
            <RotateCcw size={13} />
            <span>Undo ({secondsLeft}s)</span>
          </button>
          <button
            onClick={() => void commitRemoveBook()}
            className="p-1 text-soft transition hover:text-ink"
            title="Dismiss and permanently delete"
            aria-label="Dismiss undo"
          >
            <X size={14} />
          </button>
        </aside>
      )}
    </ErrorBoundary>
  )
}
