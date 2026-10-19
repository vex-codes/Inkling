import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Flag as FlagIcon } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Flag, type Ink } from '../lib/db.ts'
import { layer, layerFor, rangeFrom } from '../lib/anchor.ts'
import { stackMargin } from '../lib/text.ts'
import { MarginCard } from './MarginCard.tsx'

export const ink = (c: Ink) => ({ '--c': `var(--${c})` }) as CSSProperties

/** True while the page is within ~half a screen of the viewport. Off-screen pages skip all anchor work. */
function useNear(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '50% 0px' })
    io.observe(ref.current!)
    return () => io.disconnect()
  }, [ref])
  return near
}

export const Page = memo(function Page({ index, html }: { index: number; html: string }) {
  const notes = useStore(useShallow((s) => s.notes.filter((n) => n.page === index)))
  const flags = useStore(useShallow((s) => s.book?.flags.filter((f) => f.page === index) ?? []))
  const folded = useStore((s) => !!s.book?.dogears.includes(index))
  const toggleDogear = useStore((s) => s.toggleDogear)

  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const marginRef = useRef<HTMLElement>(null)
  const ranges = useRef(new Map<string, Range>())
  const near = useNear(wrapRef)
  const [hover, setHover] = useState<string | null>(null)
  const [thread, setThread] = useState<{ d: string; c: Ink } | null>(null)
  const [editing, setEditing] = useState<Flag | 'new' | null>(null)

  // Reading order = DOM order = tab order for the margin cards.
  const sorted = useMemo(() => [...notes].sort((a, b) => a.start - b.start), [notes])

  // 1 · Anchor: offsets → live Ranges, painted into the shared ink layers.
  useLayoutEffect(() => {
    const root = textRef.current
    ranges.current.clear()
    if (!near || !root) return
    const painted: [Highlight, Range][] = []
    for (const n of notes) {
      const r = rangeFrom(root, n.start, n.end)
      if (!r) continue
      ranges.current.set(n.id, r)
      const h = layerFor(n)
      if (h) { h.add(r); painted.push([h, r]) }
    }
    return () => painted.forEach(([h, r]) => h.delete(r))
  }, [notes, near])

  // 2 · Living margin: each card sits level with its line, then collisions push cards down.
  const layout = useCallback(() => {
    const text = textRef.current, margin = marginRef.current
    if (!text || !margin) return
    const base = margin.getBoundingClientRect().top
    const cards = [...margin.querySelectorAll<HTMLElement>('[data-card]')]
    const items = cards.map((el) => {
      const r = ranges.current.get(el.dataset.card!)
      const rect = r?.getClientRects()[0] ?? r?.getBoundingClientRect()
      return { top: rect ? rect.top - base - 6 : 0, height: el.offsetHeight }
    })
    const tops = stackMargin(items)
    cards.forEach((el, i) => {
      el.style.transform = `translateY(${tops[i]}px)`
      // Commit the first position before enabling transitions so new cards fade in place instead of flying in.
      if (!('placed' in el.dataset)) { void el.offsetWidth; el.dataset.placed = '' }
    })
    margin.style.minHeight = `${Math.max(0, ...tops.map((t, i) => t + items[i].height))}px`

    const col = text.parentElement!, colTop = col.getBoundingClientRect().top
    for (const el of col.querySelectorAll<HTMLElement>('[data-bracket]')) {
      const rs = ranges.current.get(el.dataset.bracket!)?.getClientRects()
      if (!rs?.length) continue
      el.style.top = `${rs[0].top - colTop}px`
      el.style.height = `${rs[rs.length - 1].bottom - rs[0].top}px`
    }
  }, [])

  // Re-run on reflow (font/size/measure changes, webfont swap, window resize) and when a card grows while typing.
  useLayoutEffect(() => {
    if (!near) return
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(textRef.current!)
    marginRef.current!.querySelectorAll('[data-card]').forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [near, sorted, layout])

  // 3 · Hover thread: a soft ink line from passage to card, and the passage glows.
  useLayoutEffect(() => {
    const n = hover ? notes.find((x) => x.id === hover) : undefined
    const r = n && ranges.current.get(n.id)
    const card = n && marginRef.current?.querySelector<HTMLElement>(`[data-card="${n.id}"]`)
    if (!n || !r || !card || !sheetRef.current) { setThread(null); return }
    const focus = layer('focus')
    focus?.add(r)
    const s = sheetRef.current.getBoundingClientRect(), rects = r.getClientRects(), last = rects[rects.length - 1], c = card.getBoundingClientRect()
    const x1 = last.right - s.left + 3, y1 = last.top + last.height / 2 - s.top
    const x2 = c.left - s.left - 3, y2 = c.top + 16 - s.top
    setThread({ d: `M${x1} ${y1} C${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`, c: n.color })
    return () => { focus?.delete(r) }
  }, [hover, notes])

  return (
    <div ref={wrapRef} data-page={index} className="sheet-wrap w-full scroll-mt-20">
      <div className="relative mx-auto w-fit max-w-full">
        <article ref={sheetRef} data-folded={folded} aria-label={`Page ${index + 1}`} className="sheet grain">
          <div className="flex h-14 items-end px-6">
            <button
              onClick={() => setEditing(editing ? null : 'new')}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-soft opacity-0 transition hover:bg-line focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [.sheet:hover_&]:opacity-100"
              aria-expanded={editing === 'new'}
            >
              <FlagIcon size={14} strokeWidth={1.6} /> <span className="smallcaps">flag page</span>
            </button>
          </div>

          <div className="grid grid-cols-[minmax(0,auto)_var(--margin-w)] gap-x-8 pb-6 pl-14 pr-5 pt-4 max-md:gap-x-5 max-md:pl-9">
            <div className="relative">
              <div ref={textRef} data-content={index} className="prose-ink" dangerouslySetInnerHTML={{ __html: html }} />
              {near && sorted.filter((n) => n.kind === 'bracket').map((n) => <span key={n.id} data-bracket={n.id} className="bracket" style={ink(n.color)} />)}
            </div>
            <aside ref={marginRef} aria-label={`Margin notes, page ${index + 1}`} className="relative">
              {near && sorted.map((n) => <MarginCard key={n.id} note={n} onHover={setHover} />)}
            </aside>
          </div>

          <footer className="smallcaps pb-8 text-center text-soft">{index + 1}</footer>

          <button
            onClick={() => toggleDogear(index)}
            className="dogear absolute right-0 top-0 z-10 size-12 cursor-pointer"
            aria-pressed={folded}
            aria-label={folded ? `Unfold corner of page ${index + 1}` : `Dog-ear page ${index + 1}`}
            title={folded ? 'Unfold corner' : 'Dog-ear this page'}
          />
          <span className="flap" />

          {thread && (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
              <path d={thread.d} fill="none" strokeWidth="1.25" strokeDasharray="3 4" strokeLinecap="round" style={{ stroke: `rgb(var(--${thread.c}))` }} />
            </svg>
          )}
          {editing && <FlagEditor page={index} flag={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
        </article>

        <div className="absolute left-full top-20 flex flex-col gap-2">
          {flags.map((f) => (
            <button key={f.id} onClick={() => setEditing(f)} style={ink(f.color)} title={`${f.label} — edit flag`}
              className="tab smallcaps max-h-40 overflow-hidden text-ellipsis whitespace-nowrap px-1 py-3 text-[13px]">
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
      onSubmit={(e) => { e.preventDefault(); saveFlag({ id: flag?.id, page, color, label: label.trim() || legend[color] }); onClose() }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="grain absolute left-6 top-14 z-20 w-72 rounded-sm bg-card p-3 shadow-xl ring-1 ring-line"
    >
      <label className="smallcaps text-xs text-soft" htmlFor={`flag-${page}`}>{flag ? 'Edit flag' : 'New sticky tab'}</label>
      <input
        id={`flag-${page}`} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={28}
        placeholder="Thesis evidence, midterm quote…"
        className="mt-1 w-full border-b border-line bg-transparent pb-1 font-hand text-xl outline-none placeholder:text-soft/60"
      />
      <div className="mt-3 flex items-center gap-1">
        {INKS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={legend[c]} aria-pressed={c === color} title={legend[c]}
            className={`grid size-8 place-items-center rounded-full ${c === color ? 'ring-1 ring-ink/40' : ''}`}>
            <span className="blot size-5" style={ink(c)} />
          </button>
        ))}
        <span className="flex-1" />
        {flag && <button type="button" onClick={() => { removeFlag(flag.id); onClose() }} className="px-2 py-1 text-sm text-soft hover:text-accent">Peel off</button>}
        <button type="submit" className="rounded-sm bg-ink px-3 py-1 text-sm text-paper">Stick</button>
      </div>
    </form>
  )
}
