import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { X, Search, ChevronRight, ChevronDown } from 'lucide-react'
import { useStore } from '../store.ts'
import { extractTocFromPages, type DetailedTocItem } from '../services/tocExtractor.ts'
import { goToPage } from './Reader.tsx'

interface TocRowProps {
  item: DetailedTocItem
  level: number
  activeId: string | null
  expandedIds: Set<string>
  onToggleExpand: (id: string, e: React.MouseEvent) => void
  onSelect: (item: DetailedTocItem) => void
  activeItemRef?: React.RefObject<HTMLButtonElement | null>
}

function TocRow({
  item,
  level,
  activeId,
  expandedIds,
  onToggleExpand,
  onSelect,
  activeItemRef,
}: TocRowProps) {
  const itemId = item.id || `${item.page}:${item.title}`
  const hasChildren = Boolean(item.children && item.children.length > 0)
  const isExpanded = expandedIds.has(itemId)
  const isActive = activeId === itemId

  // Indentation: root level at 0.75rem, children indented 1.25rem per level
  const indentRem = (level - 1) * 1.25 + 0.75
  const isTopLevel = level === 1

  return (
    <div>
      <button
        ref={isActive ? (activeItemRef as any) : undefined}
        onClick={() => onSelect(item)}
        className={`group relative w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors cursor-pointer border-0 select-none ${
          isActive
            ? 'bg-accent/15 text-accent font-medium'
            : isTopLevel
            ? 'text-ink hover:bg-line/20 font-medium'
            : 'text-soft hover:text-ink hover:bg-line/20 font-normal'
        }`}
        style={{ paddingLeft: `${indentRem}rem` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <span
              onClick={(e) => onToggleExpand(itemId, e)}
              className="grid size-5 place-items-center rounded text-soft/70 hover:text-ink hover:bg-line/30 transition-colors shrink-0 -ml-1"
              role="button"
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              {isExpanded ? (
                <ChevronDown size={14} strokeWidth={2} />
              ) : (
                <ChevronRight size={14} strokeWidth={2} />
              )}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <span
            className={`truncate font-serif text-[14px] leading-snug tracking-tight ${
              isTopLevel ? 'font-medium' : 'text-[13.5px]'
            } ${isActive ? 'text-accent font-semibold' : ''}`}
          >
            {item.title}
          </span>
        </div>

        {/* Right-aligned plain muted page number (Apple Books parity: no "P. " prefix) */}
        <span
          className={`shrink-0 font-sans tabular-nums text-[12px] tracking-tight ml-2 ${
            isActive ? 'text-accent font-medium' : 'text-soft/70 group-hover:text-soft'
          }`}
        >
          {item.pageNumber ?? item.page + 1}
        </span>
      </button>

      {/* Nested Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {item.children!.map((child) => (
            <TocRow
              key={child.id || `${child.page}:${child.title}`}
              item={child}
              level={level + 1}
              activeId={activeId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              activeItemRef={activeItemRef}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ChapterDrawer() {
  const chapterDrawer = useStore((s) => s.chapterDrawer)
  const book = useStore((s) => s.book)
  const pages = useStore((s) => s.pages)
  const { toggleChapterDrawer, updateBook } = useStore.getState()

  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const activeItemRef = useRef<HTMLButtonElement | null>(null)

  // Current reader page
  const currentPage = book?.page ?? 0

  // 1. Ensure hierarchical TOC items exist
  const tocTree: DetailedTocItem[] = useMemo(() => {
    if (!book) return []
    const hasChildren = book.toc?.some((t) => t.children && t.children.length > 0)
    if (book.toc && book.toc.length > 0 && (hasChildren || book.toc.length > 12)) {
      return book.toc
    }
    if (pages.length > 0) {
      const extracted = extractTocFromPages(pages)
      if (extracted.length > 0) {
        setTimeout(() => updateBook({ toc: extracted }), 60)
        return extracted
      }
    }
    return book.toc || []
  }, [book, pages, updateBook])

  // 2. Flatten tree in depth-first order to find active reading item and handle search
  const flattenedWithParents = useMemo(() => {
    const list: { item: DetailedTocItem; parentIds: string[] }[] = []
    const walk = (nodes: DetailedTocItem[], parents: string[]) => {
      for (const node of nodes) {
        const id = node.id || `${node.page}:${node.title}`
        list.push({ item: node, parentIds: parents })
        if (node.children && node.children.length > 0) {
          walk(node.children, [...parents, id])
        }
      }
    }
    walk(tocTree, [])
    return list
  }, [tocTree])

  // 3. Find active item ID based on currentPage
  const { activeId, activeParentIds } = useMemo(() => {
    if (flattenedWithParents.length === 0) {
      return { activeId: null, activeParentIds: [] }
    }

    // Find the last item whose starting page is <= currentPage
    let activeEntry = flattenedWithParents[0]
    for (const entry of flattenedWithParents) {
      if (entry.item.page <= currentPage) {
        activeEntry = entry
      } else {
        break
      }
    }

    const id = activeEntry.item.id || `${activeEntry.item.page}:${activeEntry.item.title}`
    return { activeId: id, activeParentIds: activeEntry.parentIds }
  }, [flattenedWithParents, currentPage])

  // 4. Automatically expand active branch when reading or opening drawer
  useEffect(() => {
    if (activeParentIds.length > 0) {
      setExpandedIds((prev) => {
        let changed = false
        const next = new Set(prev)
        for (const pid of activeParentIds) {
          if (!next.has(pid)) {
            next.add(pid)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [activeParentIds])

  // 5. Scroll active chapter into view when opening drawer
  useEffect(() => {
    if (chapterDrawer) {
      const timer = setTimeout(() => {
        activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [chapterDrawer])

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (item: DetailedTocItem) => {
      goToPage(item.page, 'instant')
      updateBook({ page: item.page })
      if (window.innerWidth < 768) {
        toggleChapterDrawer(false)
      }
    },
    [updateBook, toggleChapterDrawer]
  )

  // 6. Search filtering: if query is present, show matching flat list
  const searchResults = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    return flattenedWithParents
      .filter(({ item }) => item.title.toLowerCase().includes(q))
      .map(({ item }) => item)
  }, [query, flattenedWithParents])

  if (!book) return null

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        onClick={() => toggleChapterDrawer(false)}
        className={`fixed inset-0 z-40 bg-ink/20 backdrop-blur-xs transition-opacity duration-300 ${
          chapterDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-out drawer matching Apple Books */}
      <aside
        role="dialog"
        aria-label="Table of Contents"
        className={`grain fixed inset-y-0 left-0 z-50 flex w-full max-w-[min(360px,85vw)] min-h-dvh flex-col border-r border-line bg-card/95 backdrop-blur-md shadow-2xl transition-transform duration-300 ease-out will-change-transform ${
          chapterDrawer ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
        }`}
      >
        {/* Drawer Header (Apple Books clean typography) */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="font-serif text-[17px] font-semibold tracking-tight text-ink">
              Table of Contents
            </h2>
            <p className="truncate font-serif italic text-xs text-soft">
              {book.title}
            </p>
          </div>

          <button
            onClick={() => toggleChapterDrawer(false)}
            className="grid size-8 place-items-center rounded-md text-soft transition hover:bg-line/30 hover:text-ink cursor-pointer shrink-0"
            aria-label="Close Table of Contents (⌘B)"
            title="Close  ⌘B"
          >
            <X size={17} strokeWidth={1.5} />
          </button>
        </div>

        {/* Quick Search */}
        {flattenedWithParents.length > 8 && (
          <div className="border-b border-line/70 bg-paper/40 px-4 py-2">
            <div className="relative flex items-center">
              <Search size={13} strokeWidth={1.5} className="absolute left-2.5 text-soft pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find chapter or section..."
                className="w-full rounded-md border border-line/80 bg-card py-1.5 pl-8 pr-7 font-serif text-xs text-ink placeholder:text-soft/60 outline-none focus:border-accent"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 text-xs text-soft hover:text-ink cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chapters Navigation Tree */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {searchResults ? (
            searchResults.length === 0 ? (
              <div className="py-12 text-center font-serif italic text-xs text-soft">
                No matching chapters found.
              </div>
            ) : (
              searchResults.map((item) => {
                const itemId = item.id || `${item.page}:${item.title}`
                const isActive = activeId === itemId
                return (
                  <button
                    key={itemId}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors cursor-pointer border-0 ${
                      isActive
                        ? 'bg-accent/15 text-accent font-medium'
                        : 'text-ink hover:bg-line/20'
                    }`}
                  >
                    <span className="truncate font-serif text-[13.5px]">{item.title}</span>
                    <span className="font-sans tabular-nums text-[12px] text-soft shrink-0">
                      {item.pageNumber ?? item.page + 1}
                    </span>
                  </button>
                )
              })
            )
          ) : tocTree.length === 0 ? (
            <div className="py-12 text-center font-serif italic text-xs text-soft">
              No chapter divisions detected.
            </div>
          ) : (
            tocTree.map((item) => (
              <TocRow
                key={item.id || `${item.page}:${item.title}`}
                item={item}
                level={1}
                activeId={activeId}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onSelect={handleSelect}
                activeItemRef={activeItemRef}
              />
            ))
          )}
        </nav>

        {/* Clean Footer */}
        <footer className="border-t border-line/80 bg-paper/40 px-5 py-2.5 flex items-center justify-between text-xs text-soft">
          <span className="font-serif italic text-[11.5px]">
            {flattenedWithParents.length} {flattenedWithParents.length === 1 ? 'section' : 'sections'}
          </span>
          <span className="font-sans text-[11px] tabular-nums">
            {Math.round(((currentPage + 1) / Math.max(1, pages.length)) * 100)}% read
          </span>
        </footer>
      </aside>
    </>
  )
}
