import { useEffect, useRef, useState, useCallback } from 'react'
import { Highlighter, Spline, Brackets, StickyNote } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Ink, type Kind } from '../lib/db.ts'
import { textOffsets } from '../lib/anchor.ts'
import { ink } from './Page.tsx'

interface Target {
  page: number
  start: number
  end: number
  quote: string
  x: number
  y: number
  flipBelow: boolean
}

export function SelectionPopover() {
  const [target, setTarget] = useState<Target | null>(null)
  const [selectedKind, setSelectedKind] = useState<Kind>('highlight')
  const defaultInk = useStore((s) => s.prefs.ink)
  const legend = useStore((s) => s.book?.legend)
  const annotate = useStore((s) => s.annotate)
  const popoverRef = useRef<HTMLDivElement>(null)

  const applyAnnotation = useCallback(
    (kind: Kind, color: Ink, tgt: Target) => {
      annotate({
        page: tgt.page,
        start: tgt.start,
        end: tgt.end,
        quote: tgt.quote,
        kind,
        color,
      })
      window.getSelection()?.removeAllRanges()
      setTarget(null)
    },
    [annotate],
  )

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        return
      }

      const range = sel.getRangeAt(0)
      const container = range.commonAncestorContainer
      const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement
      const pageEl = element?.closest<HTMLElement>('[data-content]')

      if (!pageEl) {
        return
      }

      const page = Number(pageEl.dataset.content)
      const offsets = textOffsets(pageEl, range)
      if (!offsets || !offsets.quote) {
        return
      }

      const rect = range.getBoundingClientRect()
      // Smart flipping: if selection is near top of viewport (<110px), flip below
      const flipBelow = rect.top < 110
      const y = flipBelow ? rect.bottom + 10 : rect.top - 10

      setTarget({
        page,
        start: offsets.start,
        end: offsets.end,
        quote: offsets.quote,
        x: rect.left + rect.width / 2,
        y,
        flipBelow,
      })
    }

    const onPointerUp = () => {
      setTimeout(handleSelection, 20)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return
      }
      setTarget(null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')) {
        return
      }

      if (e.key === 'Escape') {
        setTarget(null)
        return
      }

      // Hotkey H: Highlight current selection in active ink
      if (target && (e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        applyAnnotation('highlight', defaultInk, target)
        return
      }

      // Hotkey N: Margin Note on current selection
      if (target && (e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        applyAnnotation('note', defaultInk, target)
        return
      }
    }

    document.addEventListener('mouseup', onPointerUp)
    document.addEventListener('touchend', onPointerUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('touchend', onPointerUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [applyAnnotation, defaultInk, target])

  if (!target) return null

  const handleApply = (color: Ink) => {
    applyAnnotation(selectedKind, color, target)
  }

  // Calculate clamped coordinates so it doesn't clip screen edges
  const left = Math.max(160, Math.min(window.innerWidth - 160, target.x))
  const top = target.y

  return (
    <div
      ref={popoverRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className={`grain fixed z-40 -translate-x-1/2 rounded-sm bg-card px-2.5 py-2 shadow-2xl ring-1 ring-line animate-in fade-in zoom-in-95 duration-100 ${
        target.flipBelow ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-line">
        {/* Kind Selectors */}
        <button
          onClick={() => setSelectedKind('highlight')}
          className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs transition ${
            selectedKind === 'highlight' ? 'bg-line text-ink font-semibold' : 'text-soft hover:text-ink'
          }`}
          title="Watercolor Highlight (Press H)"
        >
          <Highlighter size={13} />
          <span className="smallcaps text-[11px]">Highlight</span>
          <kbd className="font-sans text-[9px] opacity-60 ml-0.5">H</kbd>
        </button>

        <button
          onClick={() => setSelectedKind('squiggle')}
          className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs transition ${
            selectedKind === 'squiggle' ? 'bg-line text-ink font-semibold' : 'text-soft hover:text-ink'
          }`}
          title="Squiggle Underline"
        >
          <Spline size={13} />
          <span className="smallcaps text-[11px]">Squiggle</span>
        </button>

        <button
          onClick={() => setSelectedKind('bracket')}
          className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs transition ${
            selectedKind === 'bracket' ? 'bg-line text-ink font-semibold' : 'text-soft hover:text-ink'
          }`}
          title="Margin Bracket"
        >
          <Brackets size={13} />
          <span className="smallcaps text-[11px]">Bracket</span>
        </button>

        <button
          onClick={() => setSelectedKind('note')}
          className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs transition ${
            selectedKind === 'note' ? 'bg-line text-ink font-semibold' : 'text-soft hover:text-ink'
          }`}
          title="Margin Sticky Note (Press N)"
        >
          <StickyNote size={13} />
          <span className="smallcaps text-[11px]">Note</span>
          <kbd className="font-sans text-[9px] opacity-60 ml-0.5">N</kbd>
        </button>
      </div>

      {/* 5 Watercolor Color Swatches */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="smallcaps text-[10px] text-soft">Color:</span>
        <div className="flex items-center gap-1.5">
          {INKS.map((c) => {
            const label = legend?.[c] || c
            return (
              <button
                key={c}
                onClick={() => handleApply(c)}
                style={ink(c)}
                className={`group relative grid size-6 place-items-center rounded-full transition-transform hover:scale-110 ${
                  c === defaultInk ? 'ring-1 ring-ink' : ''
                }`}
                title={`${label} (${c})`}
              >
                <span className="blot size-4" style={ink(c)} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
