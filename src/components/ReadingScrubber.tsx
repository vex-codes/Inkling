import { useRef, useEffect, useCallback, memo, useMemo } from 'react'
import { Bookmark, Flag as FlagIcon } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS } from '../lib/db.ts'
import { goToPage } from './Reader.tsx'

interface Props {
  totalPages: number
  initialPage: number
  pagesHtml: string[]
}

export const ReadingScrubber = memo(function ReadingScrubber({ totalPages, initialPage, pagesHtml }: Props) {
  const book = useStore((s) => s.book!)
  const notes = useStore((s) => s.notes)
  const focusMode = useStore((s) => s.focusMode)

  const trackRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const scrubberThumbRef = useRef<HTMLDivElement>(null)
  const hudPillRef = useRef<HTMLDivElement>(null)
  const hudChapterRef = useRef<HTMLSpanElement>(null)
  const hudPageRef = useRef<HTMLSpanElement>(null)
  const hudPctRef = useRef<HTMLSpanElement>(null)
  const hoverTooltipRef = useRef<HTMLDivElement>(null)

  const isDraggingRef = useRef(false)
  const targetPageRef = useRef(initialPage)
  const rafJumpRef = useRef(0)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
    }
  }, [])

  // Memoize chapter milestones once
  const chapters = useMemo(() => {
    return pagesHtml
      .map((h, i) => {
        const match = h.match(/<h2[^>]*>(.*?)<\/h2>/)
        return match ? { page: i, title: match[1].replace(/<[^>]+>/g, '') } : null
      })
      .filter((c): c is { page: number; title: string } => c !== null)
  }, [pagesHtml])

  const chaptersReversed = useMemo(() => [...chapters].reverse(), [chapters])

  // Direct GPU Visuals Update (Bypasses React Re-Render Loop)
  const updateVisuals = useCallback(
    (ratio: number, pageIndex: number, chapterTitle: string) => {
      const clampedRatio = Math.max(0, Math.min(1, ratio))
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${clampedRatio})`
      }
      if (scrubberThumbRef.current && trackRef.current) {
        const trackWidth = trackRef.current.clientWidth || window.innerWidth
        scrubberThumbRef.current.style.transform = `translate3d(${clampedRatio * trackWidth}px, 0, 0)`
      }
      if (hudPillRef.current) {
        hudPillRef.current.style.opacity = '1'
        hudPillRef.current.style.pointerEvents = 'auto'
      }
      if (hudChapterRef.current) {
        hudChapterRef.current.textContent = chapterTitle
      }
      if (hudPageRef.current) {
        hudPageRef.current.textContent = `Page ${pageIndex + 1} of ${totalPages}`
      }
      if (hudPctRef.current) {
        hudPctRef.current.textContent = `(${Math.round(clampedRatio * 100)}%)`
      }
    },
    [totalPages],
  )

  // Initialize visual positions on mount
  useEffect(() => {
    const initRatio = totalPages > 1 ? initialPage / (totalPages - 1) : 0
    const ch = chaptersReversed.find((c) => c.page <= initialPage)?.title || 'Chapter I'
    updateVisuals(initRatio, initialPage, ch)
    // Initially hide pill until motion occurs
    if (hudPillRef.current) {
      hudPillRef.current.style.opacity = '0'
      hudPillRef.current.style.pointerEvents = 'none'
    }
  }, [initialPage, totalPages, chaptersReversed, updateVisuals])

  // Passive, RAF-throttled scroll listener that bypasses React state updates
  useEffect(() => {
    let ticking = false
    let scrollStopTimer = 0
    let lastScrollY = window.scrollY
    let lastScrollTime = performance.now()

    const onScroll = () => {
      const now = performance.now()
      const dt = now - lastScrollTime
      const dy = Math.abs(window.scrollY - lastScrollY)

      // Enter flight mode on high velocity (>1.2 px/ms)
      if (dt > 16) {
        const velocity = dy / dt
        if (velocity >= 1.2) {
          document.body.classList.add('flight-mode')
        }
        lastScrollY = window.scrollY
        lastScrollTime = now
      }

      if (!ticking && !isDraggingRef.current) {
        ticking = true
        requestAnimationFrame(() => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight
          const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0
          const pageIndex = Math.min(totalPages - 1, Math.max(0, Math.round(ratio * (totalPages - 1))))
          const ch = chaptersReversed.find((c) => c.page <= pageIndex)?.title || 'Chapter I'

          updateVisuals(ratio, pageIndex, ch)
          ticking = false
        })
      }

      window.clearTimeout(scrollStopTimer)
      scrollStopTimer = window.setTimeout(() => {
        document.body.classList.remove('flight-mode')
        if (hudPillRef.current && !isDraggingRef.current) {
          hudPillRef.current.style.opacity = '0'
          hudPillRef.current.style.pointerEvents = 'none'
        }
        // Commit page to store only after scrolling has stopped for >=120ms
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0
        const pageIndex = Math.min(totalPages - 1, Math.max(0, Math.round(ratio * (totalPages - 1))))
        useStore.getState().updateBook({ page: pageIndex })
        const headerPageEl = document.getElementById('header-current-page')
        if (headerPageEl) headerPageEl.textContent = `${pageIndex + 1}`
      }, 120)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(scrollStopTimer)
      cancelAnimationFrame(rafJumpRef.current)
    }
  }, [totalPages, chaptersReversed, updateVisuals])

  // Dragging: pure GPU visual glide with batched RAF scrollTo
  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    document.body.classList.add('flight-mode')

    let scrollStopTimer = 0

    const updateDrag = (ev: MouseEvent) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const pageIndex = Math.min(totalPages - 1, Math.max(0, Math.round(ratio * (totalPages - 1))))
      const ch = chaptersReversed.find((c) => c.page <= pageIndex)?.title || 'Chapter I'

      updateVisuals(ratio, pageIndex, ch)

      // Batch viewport scroll via requestAnimationFrame
      targetPageRef.current = pageIndex
      if (!rafJumpRef.current) {
        rafJumpRef.current = requestAnimationFrame(() => {
          if (targetPageRef.current >= 0) {
            const el = document.querySelector(`[data-page="${targetPageRef.current}"]`)
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
          }
          rafJumpRef.current = 0
        })
      }
    }

    const onPointerMove = (ev: MouseEvent) => {
      updateDrag(ev)
    }

    const onPointerUp = () => {
      isDraggingRef.current = false
      dragCleanupRef.current = null
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)

      window.clearTimeout(scrollStopTimer)
      scrollStopTimer = window.setTimeout(() => {
        document.body.classList.remove('flight-mode')
        if (hudPillRef.current) {
          hudPillRef.current.style.opacity = '0'
          hudPillRef.current.style.pointerEvents = 'none'
        }
        if (targetPageRef.current >= 0) {
          useStore.getState().updateBook({ page: targetPageRef.current })
          const headerPageEl = document.getElementById('header-current-page')
          if (headerPageEl) headerPageEl.textContent = `${targetPageRef.current + 1}`
        }
      }, 120)
    }

    dragCleanupRef.current = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
      document.body.classList.remove('flight-mode')
    }

    updateDrag(e.nativeEvent)
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
  }

  // Hover indicator without React state
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || !trackRef.current || !hoverTooltipRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const hoverPage = Math.min(totalPages - 1, Math.max(0, Math.round(ratio * (totalPages - 1))))

    hoverTooltipRef.current.style.left = `${ratio * 100}%`
    hoverTooltipRef.current.textContent = `Page ${hoverPage + 1}`
    hoverTooltipRef.current.style.opacity = '1'
  }

  const handleMouseLeave = () => {
    if (hoverTooltipRef.current) {
      hoverTooltipRef.current.style.opacity = '0'
    }
  }

  return (
    <>
      {/* Floating HUD Paper Scrubber Pill (Updated via Direct DOM) */}
      <div
        ref={hudPillRef}
        role="status"
        aria-live="polite"
        style={{ opacity: 0, pointerEvents: 'none', willChange: 'opacity' }}
        className="grain fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-card/95 px-5 py-2 shadow-2xl backdrop-blur-md transition-opacity duration-150"
      >
        <span ref={hudChapterRef} className="smallcaps text-xs font-semibold text-accent tracking-wider">
          Chapter I
        </span>
        <span className="text-soft/60">·</span>
        <span ref={hudPageRef} className="font-serif text-sm font-medium text-ink">
          Page 1 of {totalPages}
        </span>
        <span ref={hudPctRef} className="font-sans text-[11px] text-soft">
          (0%)
        </span>

        {/* Motif Legend Counters */}
        <div className="flex items-center gap-1.5 border-l border-line pl-2.5 ml-1">
          {INKS.map((c) => {
            const count = notes.filter((n) => n.color === c).length
            if (count === 0) return null
            const label = book.legend[c] || c
            return (
              <span key={c} className="flex items-center gap-1 text-[11px]" title={`${label}: ${count}`}>
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: `rgb(var(--${c}))` }} />
                <span className="font-mono text-soft text-[10px]">{count}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Tactile Reading Ribbon Scrubber Bar */}
      <nav
        aria-label="Reading progress scrubber"
        className={`fixed bottom-0 inset-x-0 z-20 flex flex-col justify-end transition-opacity duration-300 ${
          focusMode ? 'opacity-30 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div
          ref={trackRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="group relative h-4 w-full cursor-pointer select-none bg-paper/40 backdrop-blur-xs transition-all hover:h-6"
        >
          {/* Base Track Line */}
          <div className="absolute inset-x-0 bottom-1.5 h-1 bg-line/80 group-hover:h-1.5 transition-all">
            {/* Active Progress Fill (GPU scaleX transform) */}
            <div
              ref={progressBarRef}
              style={{ transform: 'scaleX(0)', transformOrigin: 'left center', willChange: 'transform' }}
              className="h-full w-full bg-accent/80"
            />
          </div>

          {/* Motif & Thematic Density Heatmap Ticks */}
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 h-1 z-10">
            {notes.map((n) => {
              const leftPct = totalPages > 1 ? (n.page / (totalPages - 1)) * 100 : 0
              return (
                <button
                  key={n.id}
                  type="button"
                  style={{
                    left: `${leftPct}%`,
                    backgroundColor: `rgb(var(--${n.color}))`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    goToPage(n.page)
                  }}
                  className="pointer-events-auto absolute top-0 h-full w-[3px] -translate-x-1/2 opacity-75 hover:opacity-100 hover:scale-y-200 transition-all rounded-xs cursor-pointer"
                  title={`${book.legend[n.color] || n.color}: “${n.quote.slice(0, 35)}...” (Page ${n.page + 1})`}
                />
              )
            })}
          </div>

          {/* Chapter Milestone Dots */}
          {chapters.map((ch) => {
            const leftPct = totalPages > 1 ? (ch.page / (totalPages - 1)) * 100 : 0
            return (
              <div
                key={ch.page}
                style={{ left: `${leftPct}%` }}
                className="absolute bottom-1 size-2 -translate-x-1/2 rounded-full bg-ink/50 group-hover:scale-125 transition-transform"
                title={`${ch.title} (Page ${ch.page + 1})`}
              />
            )
          })}

          {/* Dogear Markers */}
          {book.dogears.map((d) => {
            const leftPct = totalPages > 1 ? (d / (totalPages - 1)) * 100 : 0
            return (
              <div
                key={d}
                style={{ left: `${leftPct}%` }}
                className="absolute bottom-2 -translate-x-1/2 text-accent"
                title={`Dog-ear on Page ${d + 1}`}
              >
                <Bookmark size={8} fill="currentColor" />
              </div>
            )
          })}

          {/* Flag Markers */}
          {book.flags.map((f) => {
            const leftPct = totalPages > 1 ? (f.page / (totalPages - 1)) * 100 : 0
            return (
              <div
                key={f.id}
                style={{ left: `${leftPct}%` }}
                className="absolute bottom-2 -translate-x-1/2 text-[#8C3B2E]"
                title={`Flag: ${f.label} (Page ${f.page + 1})`}
              >
                <FlagIcon size={8} fill="currentColor" />
              </div>
            )
          })}

          {/* Scrubber Thumb (GPU translate3d transform) */}
          <div
            ref={scrubberThumbRef}
            style={{ transform: 'translate3d(0, 0, 0)', willChange: 'transform' }}
            className="absolute bottom-0 size-3 -translate-x-1/2 -translate-y-0.5 rounded-full border border-paper bg-ink shadow-md group-hover:scale-125 transition-transform"
          />

          {/* Hover Tooltip (Direct DOM positioned) */}
          <div
            ref={hoverTooltipRef}
            style={{ opacity: 0, willChange: 'left, opacity' }}
            className="grain pointer-events-none absolute bottom-8 -translate-x-1/2 rounded border border-line bg-card px-2 py-1 text-[11px] shadow-lg whitespace-nowrap text-ink transition-opacity duration-100"
          >
            Page 1
          </div>
        </div>
      </nav>
    </>
  )
})
