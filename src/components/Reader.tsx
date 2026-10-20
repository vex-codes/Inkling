import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Library, NotebookPen, Feather, Maximize2, Minimize2, Columns2, Link2, Unlink2 } from 'lucide-react'
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
  const comparativeMode = useStore((s) => s.comparativeMode)
  const comparativeBookId = useStore((s) => s.comparativeBookId)
  const comparativePages = useStore((s) => s.comparativePages)
  const comparativeNotes = useStore((s) => s.comparativeNotes)
  const syncScroll = useStore((s) => s.syncScroll)
  const books = useStore((s) => s.books)
  const {
    closeBook,
    toggleDrawer,
    toggleFocusMode,
    toggleComparativeMode,
    setComparativeBook,
    setComparativeNotes,
    toggleSyncScroll,
  } = useStore.getState()

  const [current] = useState(book.page)
  const currentRef = useRef(book.page)
  const lastTurnTimeRef = useRef(0)

  // Reopen where the reader left off
  useEffect(() => {
    if (currentRef.current) {
      goToPage(currentRef.current, 'instant')
    }
  }, [book.id])

  // Keyboard navigation: ⌘J quotebook · ⌘\ comparative view · J/K / Arrows page turn · F Focus mode · Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        toggleDrawer()
        return
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '\\' || e.code === 'Backslash')) {
        e.preventDefault()
        toggleComparativeMode()
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
          {/* Comparative Split-View button */}
          <button
            onClick={() => toggleComparativeMode()}
            className={`grid size-9 place-items-center rounded-md transition ${
              comparativeMode ? 'bg-line text-accent font-semibold' : 'text-soft hover:bg-line hover:text-ink focus-visible:bg-line'
            }`}
            aria-pressed={comparativeMode}
            aria-label="Comparative Split-View (⌘\)"
            title="Comparative Split-View (⌘\)"
          >
            <Columns2 size={18} strokeWidth={1.5} />
          </button>

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
        {comparativeMode ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 w-full px-4 max-w-[1920px]">
            {/* Column 1: Primary Book */}
            <div className="flex flex-col items-center gap-10">
              <div className="sticky top-14 z-20 w-full border-b border-line bg-paper/90 px-4 py-2 backdrop-blur-xs flex justify-between items-center text-xs">
                <span className="font-serif italic font-semibold">{book.title} (Primary Text)</span>
                <span className="smallcaps text-soft">Page {current + 1} of {pages.length}</span>
              </div>
              {pages.map((html, i) => (
                <Page key={`${book.id}:${i}`} index={i} html={html} />
              ))}
            </div>

            {/* Column 2: Comparative Text or Criticism / Scratchpad */}
            <div className="flex flex-col items-center gap-6 border-t xl:border-t-0 xl:border-l border-line xl:pl-8">
              {/* Secondary Header with Selector and Sync Scroll */}
              <div className="sticky top-14 z-20 w-full border-b border-line bg-paper/90 px-4 py-2 backdrop-blur-xs flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="smallcaps font-semibold text-soft">Compare:</span>
                  <select
                    value={comparativeBookId || 'scratchpad'}
                    onChange={(e) => {
                      const val = e.target.value
                      void setComparativeBook(val === 'scratchpad' ? null : val)
                    }}
                    className="rounded border border-line bg-card px-2 py-1 text-xs text-ink outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="scratchpad">✎ Comparative Criticism & Scratchpad</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        📖 {b.title} ({b.author})
                      </option>
                    ))}
                  </select>
                </div>

                {comparativeBookId && (
                  <button
                    onClick={() => toggleSyncScroll()}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                      syncScroll ? 'text-accent font-medium bg-line/60' : 'text-soft hover:text-ink'
                    }`}
                    title="Synchronize scrolling between both texts"
                  >
                    {syncScroll ? <Link2 size={12} /> : <Unlink2 size={12} />}
                    <span>Sync Scroll</span>
                  </button>
                )}
              </div>

              {comparativeBookId ? (
                <div className="flex flex-col items-center gap-10 w-full">
                  {comparativePages.map((html, i) => (
                    <div key={`comp:${comparativeBookId}:${i}`} className="w-full flex justify-center">
                      <Page index={i} html={html} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full rounded-sm border border-line bg-card p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <h3 className="font-serif italic font-semibold text-sm">Comparative Scholar Scratchpad</h3>
                    <span className="text-[11px] text-soft">Translation synthesis · Cross-textual criticism</span>
                  </div>
                  <p className="font-serif italic text-xs text-soft">
                    Place variant translations (e.g. Fagles vs. Lattimore Homer) or paste secondary literary criticism alongside the primary text. Notes persist in your session.
                  </p>
                  <textarea
                    value={comparativeNotes}
                    onChange={(e) => setComparativeNotes(e.target.value)}
                    placeholder="Type or paste translation variants, seminar prompts, or critical commentary here..."
                    className="w-full h-[60vh] rounded border border-line bg-paper/50 p-4 font-serif text-sm leading-relaxed text-ink outline-none focus:border-accent resize-none placeholder:text-soft/50"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          pages.map((html, i) => (
            <Page key={`${book.id}:${i}`} index={i} html={html} />
          ))
        )}
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
