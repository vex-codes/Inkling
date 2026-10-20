import { useEffect, useMemo, useRef, useState } from 'react'
import { X, BookOpen, Check, Search, BookmarkCheck } from 'lucide-react'
import { useStore } from '../store.ts'
import { extractTocFromPages, type DetailedTocItem } from '../services/tocExtractor.ts'
import { goToPage } from './Reader.tsx'

export function ChapterDrawer() {
  const chapterDrawer = useStore((s) => s.chapterDrawer)
  const book = useStore((s) => s.book)
  const pages = useStore((s) => s.pages)
  const { toggleChapterDrawer, updateBook } = useStore.getState()

  const [query, setQuery] = useState('')
  const activeItemRef = useRef<HTMLButtonElement>(null)

  // Current page derived from book.page
  const currentPage = book?.page ?? 0

  // Ensure TOC exists, extracting from pages if needed
  const tocItems: DetailedTocItem[] = useMemo(() => {
    if (!book) return []
    if (book.toc && book.toc.length > 0) {
      return book.toc
    }
    if (pages.length > 0) {
      const extracted = extractTocFromPages(pages)
      if (extracted.length > 0) {
        // Cache to book in background
        setTimeout(() => updateBook({ toc: extracted }), 50)
      }
      return extracted
    }
    return []
  }, [book, pages, updateBook])

  const filtered = useMemo(() => {
    if (!query.trim()) return tocItems
    const q = query.toLowerCase()
    return tocItems.filter((item) => item.title.toLowerCase().includes(q))
  }, [tocItems, query])

  // Scroll active chapter into view when opening drawer
  useEffect(() => {
    if (chapterDrawer) {
      const timer = setTimeout(() => {
        activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [chapterDrawer])

  if (!book) return null

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        onClick={() => toggleChapterDrawer(false)}
        className={`fixed inset-0 z-30 bg-ink/15 backdrop-blur-xs transition-opacity duration-300 ${
          chapterDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Left slide-out drawer (Apple Books parity) */}
      <aside
        role="dialog"
        aria-label="Table of Contents"
        className={`grain fixed inset-y-0 left-0 z-40 flex w-full max-w-[min(380px,85vw)] min-h-dvh flex-col border-r border-line bg-card/95 backdrop-blur-md shadow-2xl transition-transform duration-300 ease-out will-change-transform ${
          chapterDrawer ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen size={18} strokeWidth={1.5} className="text-accent" />
            <div>
              <h2 className="smallcaps text-base font-semibold tracking-wider">Contents</h2>
              <p className="font-serif italic text-xs text-soft truncate max-w-[200px]">
                {book.title}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleChapterDrawer(false)}
            className="p-1.5 text-soft transition hover:text-ink hover:bg-line/40 rounded-sm cursor-pointer"
            aria-label="Close Table of Contents (⌘B)"
            title="Close  ⌘B"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Quick Search for dense / multi-chapter publications */}
        {tocItems.length > 8 && (
          <div className="border-b border-line bg-paper/40 px-5 py-2.5">
            <div className="relative flex items-center">
              <Search size={14} strokeWidth={1.5} className="absolute left-3 text-soft pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find chapter or section..."
                className="w-full rounded border border-line bg-card py-1.5 pl-8 pr-3 font-serif text-xs text-ink placeholder:text-soft/60 outline-none focus:border-accent"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 text-xs text-soft hover:text-ink cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chapter List */}
        <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center font-serif italic text-xs text-soft">
              {query ? 'No matching chapters found.' : 'No chapter divisions detected.'}
            </div>
          ) : (
            filtered.map((item, idx) => {
              // Find next chapter to determine active reading range
              const nextItem = tocItems[idx + 1]
              const isCurrent =
                currentPage >= item.page && (nextItem ? currentPage < nextItem.page : true)
              const isReadPast = nextItem ? currentPage >= nextItem.page : currentPage > item.page

              return (
                <button
                  key={`${item.page}:${item.title}:${idx}`}
                  ref={isCurrent ? activeItemRef : undefined}
                  onClick={() => {
                    goToPage(item.page, 'instant')
                    if (window.innerWidth < 768) {
                      toggleChapterDrawer(false)
                    }
                  }}
                  className={`group relative w-full flex items-center justify-between gap-3 rounded-sm px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-accent/10 border border-accent/25 text-accent font-semibold shadow-xs'
                      : 'hover:bg-paper/80 text-ink/90 border border-transparent'
                  }`}
                  style={{
                    paddingLeft: item.level && item.level > 1 ? `${(item.level - 1) * 1.2 + 0.875}rem` : '0.875rem',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isCurrent ? (
                      <BookmarkCheck size={14} strokeWidth={2} className="shrink-0 text-accent animate-pulse" />
                    ) : isReadPast ? (
                      <Check size={12} strokeWidth={2} className="shrink-0 text-soft/50" />
                    ) : (
                      <span className="shrink-0 size-1.5 rounded-full bg-line/60" />
                    )}
                    <span
                      className={`truncate font-serif text-[13px] ${
                        isCurrent ? 'text-accent font-medium' : 'text-ink group-hover:text-accent'
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>

                  <span className="smallcaps font-mono text-[11px] text-soft shrink-0">
                    p. {item.page + 1}
                  </span>
                </button>
              )
            })
          )}
        </nav>

        {/* Footer Statistics */}
        <footer className="border-t border-line bg-paper/50 px-6 py-3 flex items-center justify-between text-xs text-soft">
          <span className="font-serif italic">
            {tocItems.length} {tocItems.length === 1 ? 'Chapter' : 'Chapters'}
          </span>
          <span className="smallcaps font-mono">
            {Math.round(((currentPage + 1) / Math.max(1, pages.length)) * 100)}% Read
          </span>
        </footer>
      </aside>
    </>
  )
}
