import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Library, NotebookPen, Feather, Maximize2, Minimize2 } from 'lucide-react'
import { useStore } from '../store.ts'
import { Page } from './Page.tsx'
import { SelectionPopover } from './SelectionPopover.tsx'
import { Quotebook } from './Quotebook.tsx'
import { Customizer, FONTS } from './Customizer.tsx'
import { ReadingScrubber } from './ReadingScrubber.tsx'

export const goToPage = (i: number, behavior: ScrollBehavior = 'smooth') => {
  const el = document.querySelector(`[data-page="${i}"]`)
  if (el) {
    el.scrollIntoView({ behavior, block: 'start' })
  }
}

export function Reader() {
  const book = useStore((s) => s.book!)
  const pages = useStore((s) => s.pages)
  const prefs = useStore((s) => s.prefs)
  const count = useStore((s) => s.notes.length)
  const drawer = useStore((s) => s.drawer)
  const isSaving = useStore((s) => s.isSaving)
  const focusMode = useStore((s) => s.focusMode)
  const { closeBook, toggleDrawer, toggleFocusMode } = useStore.getState()

  const [current] = useState(book.page)
  const currentRef = useRef(book.page)
  const lastTurnTimeRef = useRef(0)

  // Reopen where the reader left off
  useEffect(() => {
    if (currentRef.current) {
      goToPage(currentRef.current, 'instant')
    }
  }, [book.id])

  // Keyboard navigation: ⌘J quotebook · J/K / Arrows page turn · F Focus mode · Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        toggleDrawer()
        return
      }

      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) {
        return
      }

      // Focus Mode toggle
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFocusMode()
        return
      }

      if (e.key === 'j' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        const now = Date.now()
        const behavior = now - lastTurnTimeRef.current < 260 ? 'instant' : 'smooth'
        lastTurnTimeRef.current = now
        const next = Math.min(currentRef.current + 1, pages.length - 1)
        goToPage(next, behavior)
      } else if (e.key === 'k' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        const now = Date.now()
        const behavior = now - lastTurnTimeRef.current < 260 ? 'instant' : 'smooth'
        lastTurnTimeRef.current = now
        const prev = Math.max(currentRef.current - 1, 0)
        goToPage(prev, behavior)
      } else if (e.key === 'Escape') {
        if (drawer) {
          toggleDrawer(false)
        } else if (focusMode) {
          toggleFocusMode(false)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, focusMode, pages.length, toggleDrawer, toggleFocusMode])

  const vars = {
    '--read-font': FONTS[prefs.font].family,
    '--read-size': `${prefs.size}px`,
    '--read-leading': prefs.leading,
    '--read-measure': prefs.measure,
  } as CSSProperties

  return (
    <div
      style={vars}
      onDoubleClick={(e) => {
        // Double clicking page background toggles focus mode
        if ((e.target as HTMLElement).closest?.('.prose-ink, .slip, button, input, textarea')) return
        toggleFocusMode()
      }}
      className={`min-h-dvh transition-all duration-300 ${
        focusMode ? 'focus-mode-active' : ''
      }`}
    >
      {/* Sticky Header Bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/85 px-4 py-2.5 backdrop-blur-md transition-all duration-300 sm:px-6">
        <button
          onClick={closeBook}
          className="grid size-9 place-items-center rounded-md text-soft transition hover:bg-line hover:text-ink focus-visible:bg-line"
          aria-label="Back to bookshelf"
          title="Bookshelf"
        >
          <Library size={18} strokeWidth={1.5} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-base italic leading-tight font-serif">{book.title}</h1>
          <div className="flex items-center justify-center gap-2 text-[12px] text-soft">
            <span className="smallcaps truncate">
              {book.author || 'Unknown author'} · page <span id="header-current-page">{current + 1}</span> of {pages.length}
            </span>
            {isSaving && (
              <span className="flex items-center gap-1 text-[11px] text-accent animate-pulse" title="Saving thought to browser storage">
                <Feather size={11} strokeWidth={1.75} />
                <span className="smallcaps font-sans">saving</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Focus Mode button */}
          <button
            onClick={() => toggleFocusMode()}
            className="grid size-9 place-items-center rounded-md text-soft transition hover:bg-line hover:text-ink focus-visible:bg-line"
            aria-label={focusMode ? 'Exit focus mode (F)' : 'Focus mode (F)'}
            title={focusMode ? 'Exit focus mode (F)' : 'Focus mode (F)'}
          >
            {focusMode ? <Minimize2 size={18} strokeWidth={1.5} /> : <Maximize2 size={18} strokeWidth={1.5} />}
          </button>

          <Customizer />

          <button
            onClick={() => toggleDrawer()}
            className="relative grid size-9 place-items-center rounded-md text-soft transition hover:bg-line hover:text-ink focus-visible:bg-line"
            aria-pressed={drawer}
            aria-label="Quotebook (⌘J)"
            title="Quotebook  ⌘J"
          >
            <NotebookPen size={18} strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 font-sans text-[10px] font-bold leading-[18px] text-paper">
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Pages Flow */}
      <main
        className={`flex flex-col items-center gap-12 pb-44 pt-10 transition-[padding] duration-500 ${
          drawer ? 'xl:pr-[26rem]' : ''
        }`}
      >
        {pages.map((html, i) => (
          <Page key={`${book.id}:${i}`} index={i} html={html} />
        ))}
        <p className="smallcaps text-soft py-8">❦ end of {book.title} ❦</p>
      </main>

      {/* Floating Exit Focus Mode Badge */}
      {focusMode && (
        <button
          onClick={() => toggleFocusMode(false)}
          className="grain fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-full border border-line bg-card/90 px-3.5 py-1.5 font-serif text-xs text-soft shadow-lg backdrop-blur-sm transition hover:text-ink hover:border-accent"
        >
          <Minimize2 size={13} strokeWidth={1.5} />
          <span>Exit Focus (F)</span>
        </button>
      )}

      {/* Bottom Reading Ribbon Scrubber with HUD Pill (Direct DOM Zero Re-render) */}
      <ReadingScrubber totalPages={pages.length} initialPage={current} pagesHtml={pages} />

      <SelectionPopover />
      <Quotebook />
    </div>
  )
}
