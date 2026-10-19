import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Bookmark, Flag as FlagIcon } from 'lucide-react'
import { useStore } from '../store.ts'
import { goToPage } from './Reader.tsx'

interface Props {
  totalPages: number
  currentPage: number
  pagesHtml: string[]
}

export const ReadingScrubber = memo(function ReadingScrubber({ totalPages, currentPage, pagesHtml }: Props) {
  const book = useStore((s) => s.book!)
  const isFastScrolling = useStore((s) => s.isFastScrolling)
  const setFastScrolling = useStore((s) => s.setFastScrolling)
  const focusMode = useStore((s) => s.focusMode)

  const [isScrubbing, setIsScrubbing] = useState(false)
  const [hoverPage, setHoverPage] = useState<number | null>(null)
  const [scrubPage, setScrubPage] = useState<number>(currentPage)
  const trackRef = useRef<HTMLDivElement>(null)

  // Identify chapter milestones
  const chapters = pagesHtml.map((h, i) => {
    const match = h.match(/<h2[^>]*>(.*?)<\/h2>/)
    return match ? { page: i, title: match[1].replace(/<[^>]+>/g, '') } : null
  }).filter((c): c is { page: number; title: string } => c !== null)

  const activePage = isScrubbing ? scrubPage : currentPage
  const activeChapter = [...chapters].reverse().find((c) => c.page <= activePage)?.title || 'Chapter I'

  const calculatePageFromEvent = useCallback((e: MouseEvent | TouchEvent) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (totalPages - 1))
  }, [totalPages])

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsScrubbing(true)
    setFastScrolling(true)
    const target = calculatePageFromEvent(e.nativeEvent)
    setScrubPage(target)
    goToPage(target, 'instant')

    const onPointerMove = (ev: MouseEvent) => {
      const p = calculatePageFromEvent(ev)
      setScrubPage(p)
      goToPage(p, 'instant')
    }

    const onPointerUp = () => {
      setIsScrubbing(false)
      setTimeout(() => setFastScrolling(false), 120)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
    }

    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
  }

  // Sync scrub page with scroll position
  useEffect(() => {
    if (!isScrubbing) {
      setScrubPage(currentPage)
    }
  }, [currentPage, isScrubbing])

  const progressPct = totalPages > 1 ? (activePage / (totalPages - 1)) * 100 : 0
  const showPill = isFastScrolling || isScrubbing

  return (
    <>
      {/* Floating HUD Paper Scrubber Pill */}
      {showPill && (
        <div
          role="status"
          aria-live="polite"
          className="grain fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-card/95 px-5 py-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          <span className="smallcaps text-xs font-semibold text-accent tracking-wider">
            {activeChapter}
          </span>
          <span className="text-soft/60">·</span>
          <span className="font-serif text-sm font-medium text-ink">
            Page {activePage + 1} of {totalPages}
          </span>
          <span className="font-sans text-[11px] text-soft">
            ({Math.round(((activePage + 1) / totalPages) * 100)}%)
          </span>
        </div>
      )}

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
          onMouseMove={(e) => setHoverPage(calculatePageFromEvent(e.nativeEvent))}
          onMouseLeave={() => setHoverPage(null)}
          className="group relative h-4 w-full cursor-pointer select-none bg-paper/40 backdrop-blur-xs transition-all hover:h-6"
        >
          {/* Base Track Line */}
          <div className="absolute inset-x-0 bottom-1.5 h-1 bg-line/80 group-hover:h-1.5 transition-all">
            {/* Active Progress Fill */}
            <div
              className="h-full bg-accent/80 transition-all duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Chapter Milestone Dots */}
          {chapters.map((ch) => {
            const leftPct = (ch.page / (totalPages - 1)) * 100
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
            const leftPct = (d / (totalPages - 1)) * 100
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
            const leftPct = (f.page / (totalPages - 1)) * 100
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

          {/* Scrubber Thumb */}
          <div
            style={{ left: `${progressPct}%` }}
            className="absolute bottom-0 size-3 -translate-x-1/2 -translate-y-0.5 rounded-full border border-paper bg-ink shadow-md group-hover:scale-125 transition-transform"
          />

          {/* Hover Tooltip */}
          {hoverPage !== null && !isScrubbing && (
            <div
              style={{ left: `${(hoverPage / (totalPages - 1)) * 100}%` }}
              className="grain pointer-events-none absolute bottom-8 -translate-x-1/2 rounded border border-line bg-card px-2 py-1 text-[11px] shadow-lg whitespace-nowrap text-ink"
            >
              Page {hoverPage + 1}
            </div>
          )}
        </div>
      </nav>
    </>
  )
})
