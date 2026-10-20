import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Flag as FlagIcon, Trash2 } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Flag, type Ink } from '../lib/db.ts'
import { layer, layerFor, rangeFrom } from '../lib/anchor.ts'
import { stackMargin } from '../lib/text.ts'
import { MarginCard } from './MarginCard.tsx'

export const ink = (c: Ink) => ({ '--c': `var(--${c})` }) as CSSProperties

interface ThreadLine {
  id: string
  d: string
  c: Ink
  isHovered: boolean
}

/** True while page is within overscan buffer (250% = +-2 to 3 surrounding pages). Off-screen pages abort heavy anchor work. */
function useNear(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '250% 0px' })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [ref])
  return near
}

export const Page = memo(function Page({ index, html }: { index: number; html: string }) {
  const notes = useStore(useShallow((s) => s.notes.filter((n) => n.page === index)))
  const flags = useStore(useShallow((s) => s.book?.flags.filter((f) => f.page === index) ?? []))
  const folded = useStore((s) => !!s.book?.dogears.includes(index))
  const toggleDogear = useStore((s) => s.toggleDogear)
  const isPruned = useStore((s) => s.book?.prunedPages?.includes(index) ?? false)
  const prunePage = useStore((s) => s.prunePage)
  const [isCollapsing, setIsCollapsing] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const marginRef = useRef<HTMLElement>(null)
  const ranges = useRef(new Map<string, Range>())
  const near = useNear(wrapRef)

  const [hover, setHover] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadLine[]>([])
  const [displacedIds, setDisplacedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Flag | 'new' | null>(null)

  const rafRef = useRef<number>(0)

  // Reading order = DOM order
  const sorted = useMemo(() => [...notes].sort((a, b) => a.start - b.start), [notes])

  // Key tracking ONLY geometric anchor changes (prevents typing in note from rebuilding text ranges)
  const anchorSignature = useMemo(
    () => sorted.map((n) => `${n.id}:${n.start}:${n.end}:${n.kind}:${n.color}`).join(';'),
    [sorted],
  )

  // 1 · Anchor: offsets → live Ranges, painted into shared CSS highlights
  useLayoutEffect(() => {
    const root = textRef.current
    ranges.current.clear()
    if (!near || !root) return
    const painted: [Highlight, Range][] = []
    for (const n of sorted) {
      const r = rangeFrom(root, n.start, n.end)
      if (!r) continue
      ranges.current.set(n.id, r)
      const h = layerFor(n)
      if (h) {
        h.add(r)
        painted.push([h, r])
      }
    }
    return () => {
      painted.forEach(([h, r]) => h.delete(r))
    }
  }, [anchorSignature, near, sorted])

  // 2 · Living margin layout with requestAnimationFrame batching & Abort guard
  const scheduleLayout = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (!near) return
    rafRef.current = requestAnimationFrame(() => {
      if (!near) return
      const text = textRef.current
      const margin = marginRef.current
      const sheet = sheetRef.current
      if (!text || !margin || !sheet) return

      const base = margin.getBoundingClientRect().top
      const sheetRect = sheet.getBoundingClientRect()
      const cards = [...margin.querySelectorAll<HTMLElement>('[data-card]')]

      const items = cards.map((el) => {
        const r = ranges.current.get(el.dataset.card!)
        const rect = r?.getClientRects()[0] ?? r?.getBoundingClientRect()
        return {
          top: rect ? rect.top - base - 6 : 0,
          height: el.offsetHeight,
          desiredTop: rect ? rect.top - base - 6 : 0,
          rect,
        }
      })

      const tops = stackMargin(items, 12)
      const displaced = new Set<string>()
      const newThreads: ThreadLine[] = []

      cards.forEach((el, i) => {
        const id = el.dataset.card!
        const finalTop = tops[i]
        const origTop = items[i].desiredTop
        el.style.transform = `translate3d(0, ${finalTop}px, 0)`
        el.style.willChange = 'transform'
        el.dataset.placed = 'true'

        // Detect collision displacement
        const isMovedDown = Math.abs(finalTop - origTop) > 6
        if (isMovedDown) {
          displaced.add(id)
        }

        // Generate SVG thread curve if hovered OR displaced by collision
        const isHovered = hover === id
        if ((isHovered || isMovedDown) && items[i].rect) {
          const r = items[i].rect!
          const noteObj = sorted.find((x) => x.id === id)
          if (noteObj) {
            const x1 = r.right - sheetRect.left + 4
            const y1 = r.top + r.height / 2 - sheetRect.top
            const cardRect = el.getBoundingClientRect()
            const x2 = cardRect.left - sheetRect.left - 3
            const y2 = finalTop + base + 14 - sheetRect.top

            const dx = Math.max(16, (x2 - x1) * 0.45)
            const d = `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
            newThreads.push({ id, d, c: noteObj.color, isHovered })
          }
        }
      })

      margin.style.minHeight = `${Math.max(0, ...tops.map((t, i) => t + items[i].height))}px`
      setDisplacedIds(displaced)
      setThreads(newThreads)

      // Align vertical bracket indicators
      const col = text.parentElement!
      const colTop = col.getBoundingClientRect().top
      for (const el of col.querySelectorAll<HTMLElement>('[data-bracket]')) {
        const rs = ranges.current.get(el.dataset.bracket!)?.getClientRects()
        if (!rs?.length) continue
        el.style.top = `${rs[0].top - colTop}px`
        el.style.height = `${rs[rs.length - 1].bottom - rs[0].top}px`
      }
    })
  }, [hover, sorted])

  // Re-run layout on reflow & ResizeObserver
  useLayoutEffect(() => {
    if (!near) return
    scheduleLayout()
    const ro = new ResizeObserver(scheduleLayout)
    if (textRef.current) ro.observe(textRef.current)
    marginRef.current?.querySelectorAll('[data-card]').forEach((el) => ro.observe(el))
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [near, anchorSignature, scheduleLayout])

  // Glow active highlight layer when hovered
  useLayoutEffect(() => {
    const n = hover ? sorted.find((x) => x.id === hover) : undefined
    const r = n && ranges.current.get(n.id)
    if (!r) return
    const focus = layer('focus')
    focus?.add(r)
    return () => {
      focus?.delete(r)
    }
  }, [hover, sorted])

  // Abort heavy vector/annotation parsing when page leaves near buffer
  useEffect(() => {
    if (!near) {
      cancelAnimationFrame(rafRef.current)
      setThreads([])
      setDisplacedIds(new Set())
    }
  }, [near])

  // Instant Fallback Skeleton: If page html is not yet ready, display warm parchment skeleton
  if (!html) {
    return (
      <div ref={wrapRef} data-page={index} className="sheet-wrap reader-page-container w-full scroll-mt-20">
        <div className="relative mx-auto w-fit max-w-full">
          <article className="sheet grain sanctuary-page-skeleton animate-pulse rounded-sm p-12 min-h-[720px] flex flex-col justify-between">
            <div className="space-y-4 pt-10 max-w-xl mx-auto w-full">
              <div className="h-4 w-1/3 rounded-sm bg-line/40 mx-auto mb-10" />
              <div className="h-3 w-full rounded-sm bg-line/30" />
              <div className="h-3 w-11/12 rounded-sm bg-line/30" />
              <div className="h-3 w-full rounded-sm bg-line/30" />
              <div className="h-3 w-4/5 rounded-sm bg-line/30" />
              <div className="h-3 w-full rounded-sm bg-line/30" />
              <div className="h-3 w-5/6 rounded-sm bg-line/30" />
              <div className="h-3 w-full rounded-sm bg-line/30" />
              <div className="h-3 w-3/4 rounded-sm bg-line/30" />
            </div>
            <footer className="smallcaps text-center text-xs text-soft/50 font-serif italic pb-4">
              ❦ Leaf {index + 1} binding ❦
            </footer>
          </article>
        </div>
      </div>
    )
  }

  const handleHidePage = () => {
    setIsCollapsing(true)
    setTimeout(() => {
      void prunePage(index)
    }, 200)
  }

  if (isPruned && !isCollapsing) {
    return null
  }

  return (
    <div ref={wrapRef} data-page={index} className="sheet-wrap reader-page-container w-full scroll-mt-20">
      <div className="relative mx-auto w-fit max-w-full">
        <article
          ref={sheetRef}
          data-folded={folded}
          aria-label={`Page ${index + 1}`}
          className="sheet grain transition-all duration-200"
          style={{
            transform: isCollapsing ? 'scaleY(0) translate3d(0, -24px, 0)' : 'scaleY(1)',
            transformOrigin: 'top center',
            opacity: isCollapsing ? 0 : 1,
            maxHeight: isCollapsing ? 0 : undefined,
            overflow: isCollapsing ? 'hidden' : undefined,
          }}
        >
          <div className="flex h-14 items-end px-6">
            <button
              onClick={() => setEditing(editing ? null : 'new')}
              className="flag-btn flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs text-soft opacity-0 transition hover:bg-line focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [.sheet:hover_&]:opacity-100"
              aria-expanded={editing === 'new'}
            >
              <FlagIcon size={14} strokeWidth={1.5} /> <span className="smallcaps">flag page</span>
            </button>
          </div>

          <div className="grid grid-cols-[minmax(0,auto)_var(--margin-w)] gap-x-8 pb-6 pl-14 pr-5 pt-4 max-md:gap-x-4 max-md:pl-8 max-sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <div ref={textRef} data-content={index} className="prose-ink inkling-page-content" dangerouslySetInnerHTML={{ __html: html }} />
              {near &&
                sorted
                  .filter((n) => n.kind === 'bracket')
                  .map((n) => <span key={n.id} data-bracket={n.id} className="bracket" style={ink(n.color)} />)}
            </div>

            <aside ref={marginRef} aria-label={`Margin notes, page ${index + 1}`} className="living-margin-col relative">
              {near &&
                sorted.map((n) => (
                  <MarginCard
                    key={n.id}
                    note={n}
                    isDisplaced={displacedIds.has(n.id)}
                    onHover={setHover}
                  />
                ))}

              {/* Empty State Delight: Guideline & Watermark Prompt */}
              {sorted.length === 0 && (
                <div className="empty-margin-watermark pointer-events-none select-none flex h-full min-h-[220px] flex-col justify-start pt-8 text-center opacity-30 transition-opacity duration-300">
                  <div className="mx-auto h-16 w-px border-r border-dashed border-line/80" />
                  <p className="mt-3 font-serif text-[11px] italic tracking-wide text-soft leading-relaxed px-1">
                    Select text or press <kbd className="font-mono text-[9px] uppercase font-bold border border-line px-1 py-0.5 rounded bg-paper/50">H</kbd> to highlight, <kbd className="font-mono text-[9px] uppercase font-bold border border-line px-1 py-0.5 rounded bg-paper/50">N</kbd> to jot a thought.
                  </p>
                </div>
              )}
            </aside>
          </div>

          <footer className="smallcaps pb-8 px-8 text-center text-soft flex items-center justify-between">
            <span className="w-20" />
            <span className="flex-1">{index + 1}</span>
            <div className="w-20 flex justify-end">
              <button
                type="button"
                onClick={handleHidePage}
                className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [.sheet:hover_&]:opacity-100 flex items-center gap-1 text-[11px] text-[#B45309] hover:bg-amber-500/10 px-2 py-0.5 rounded cursor-pointer"
                title="Hide / Prune blank page or scanner artifact"
              >
                <Trash2 size={12} strokeWidth={1.5} />
                <span className="font-sans normal-case">Hide</span>
              </button>
            </div>
          </footer>

          <button
            onClick={() => toggleDogear(index)}
            className="dogear absolute right-0 top-0 z-10 size-12 cursor-pointer"
            aria-pressed={folded}
            aria-label={folded ? `Unfold corner of page ${index + 1}` : `Dog-ear page ${index + 1}`}
            title={folded ? 'Unfold corner' : 'Dog-ear this page'}
          />
          <span className="flap" />

          {/* SVG Thread Lines for Hover & Collisions (hidden instantly in flight-mode) */}
          {threads.length > 0 && (
            <svg className="threads-svg pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
              {threads.map((t) => (
                <path
                  key={t.id}
                  d={t.d}
                  fill="none"
                  strokeWidth={t.isHovered ? 1.6 : 1.1}
                  strokeDasharray={t.isHovered ? 'none' : '3 3'}
                  strokeLinecap="round"
                  style={{
                    stroke: `rgb(var(--${t.c}))`,
                    opacity: t.isHovered ? 0.95 : 0.45,
                    filter: t.isHovered ? 'drop-shadow(0 1px 2px rgb(var(--shade)/.2))' : 'none',
                    transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
                  }}
                />
              ))}
            </svg>
          )}

          {editing && (
            <FlagEditor page={index} flag={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
          )}
        </article>

        {/* Outer Sticky Tabs */}
        <div className="sheet-flags absolute left-full top-20 flex flex-col gap-2">
          {flags.map((f) => (
            <button
              key={f.id}
              onClick={() => setEditing(f)}
              style={ink(f.color)}
              title={`${f.label} — edit flag`}
              className="tab smallcaps max-h-40 overflow-hidden text-ellipsis whitespace-nowrap px-1 py-3 text-[13px]"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

function FlagEditor({ page, flag, onClose }: { page: number; flag: Flag | null; onClose: () => void }) {
  const legend = useStore((s) => s.book!.legend)
  const defaultInk = useStore((s) => s.prefs.ink)
  const { saveFlag, removeFlag } = useStore.getState()
  const [label, setLabel] = useState(flag?.label ?? '')
  const [color, setColor] = useState<Ink>(flag?.color ?? defaultInk)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        saveFlag({ id: flag?.id, page, color, label: label.trim() || legend[color] })
        onClose()
      }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="grain absolute left-6 top-14 z-20 w-72 rounded-sm bg-card p-3 shadow-xl ring-1 ring-line animate-in fade-in zoom-in-95"
    >
      <label className="smallcaps text-xs text-soft" htmlFor={`flag-${page}`}>
        {flag ? 'Edit flag' : 'New sticky tab'}
      </label>
      <input
        id={`flag-${page}`}
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={28}
        placeholder="Thesis evidence, midterm quote…"
        className="mt-1 w-full border-b border-line bg-transparent pb-1 font-hand text-xl outline-none placeholder:text-soft/60"
      />
      <div className="mt-3 flex items-center gap-1">
        {INKS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={legend[c]}
            aria-pressed={c === color}
            title={legend[c]}
            className={`grid size-8 place-items-center rounded-full ${c === color ? 'ring-1 ring-ink/40' : ''}`}
          >
            <span className="blot size-5" style={ink(c)} />
          </button>
        ))}
        <span className="flex-1" />
        {flag && (
          <button
            type="button"
            onClick={() => {
              removeFlag(flag.id)
              onClose()
            }}
            className="px-2 py-1 text-sm text-soft hover:text-accent"
          >
            Peel off
          </button>
        )}
        <button type="submit" className="rounded-sm bg-ink px-3 py-1 text-sm text-paper">
          Stick
        </button>
      </div>
    </form>
  )
}
