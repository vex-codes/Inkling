import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Library, NotebookPen, Feather } from 'lucide-react'
import { useStore } from '../store.ts'
import { Page } from './Page.tsx'
import { SelectionPopover } from './SelectionPopover.tsx'
import { Quotebook } from './Quotebook.tsx'
import { Customizer, FONTS, iconBtn } from './Customizer.tsx'

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
  const { closeBook, toggleDrawer, updateBook } = useStore.getState()

  const [current, setCurrent] = useState(book.page)
  const currentRef = useRef(book.page)
  const lastTurnTimeRef = useRef(0)

  // Reopen where the reader left off
  useEffect(() => {
    if (currentRef.current) {
      goToPage(currentRef.current, 'instant')
    }
  }, [book.id])

  // Track the page under the reading line; persist it (debounced)
  useEffect(() => {
    let raf = 0
    let timer = 0

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.35)?.closest<HTMLElement>('[data-page]')
        const p = el ? Number(el.dataset.page) : currentRef.current
        if (p === currentRef.current) return
        currentRef.current = p
        setCurrent(p)
        clearTimeout(timer)
        timer = window.setTimeout(() => updateBook({ page: p }), 500)
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [updateBook])

  // Keyboard navigation: ⌘J quotebook · J/K / Arrows page turn · Esc closes drawer
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

      if (e.key === 'j' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        const now = Date.now()
        // If rapidly tapping (spamming), jump instantly to avoid queuing 20 smooth scrolls
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
        toggleDrawer(false)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length, toggleDrawer])

  const vars = {
    '--read-font': FONTS[prefs.font].family,
    '--read-size': `${prefs.size}px`,
    '--read-leading': prefs.leading,
    '--read-measure': prefs.measure,
  } as CSSProperties

  return (
    <div style={vars} className="min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/85 px-3 py-2 backdrop-blur-md sm:px-5">
        <button onClick={closeBook} className={iconBtn} aria-label="Back to bookshelf" title="Bookshelf">
          <Library size={19} strokeWidth={1.6} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg italic leading-tight">{book.title}</h1>
          <div className="flex items-center justify-center gap-1.5 text-[12px] text-soft">
            <span className="smallcaps truncate">
              {book.author || 'Unknown author'} · page {current + 1} of {pages.length}
            </span>
            {isSaving && (
              <span className="flex items-center gap-1 text-[11px] text-accent animate-pulse" title="Saving thought to browser storage">
                <Feather size={11} strokeWidth={2} />
                <span className="smallcaps font-sans">saving</span>
              </span>
            )}
          </div>
        </div>

        <Customizer />

        <button
          onClick={() => toggleDrawer()}
          className={`${iconBtn} relative`}
          aria-pressed={drawer}
          aria-label="Quotebook (⌘J)"
          title="Quotebook  ⌘J"
        >
          <NotebookPen size={19} strokeWidth={1.6} />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 font-sans text-[10px] font-bold leading-[18px] text-paper">
              {count}
            </span>
          )}
        </button>
      </header>

      <main
        className={`flex flex-col items-center gap-10 pb-40 pt-10 transition-[padding] duration-500 ${
          drawer ? 'xl:pr-[26rem]' : ''
        }`}
      >
        {pages.map((html, i) => (
          <Page key={`${book.id}:${i}`} index={i} html={html} />
        ))}
        <p className="smallcaps text-soft">❦ end of {book.title} ❦</p>
      </main>

      <SelectionPopover />
      <Quotebook />
    </div>
  )
}
