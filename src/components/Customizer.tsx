import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Font, type Theme, DEFAULT_PREFS } from '../lib/db.ts'
import { ink } from './Page.tsx'

export const FONTS: Record<Font, { label: string; family: string; desc: string }> = {
  garamond: {
    label: 'EB Garamond',
    family: '"EB Garamond", Garamond, "Iowan Old Style", Georgia, serif',
    desc: 'Classic literary serif',
  },
  baskerville: {
    label: 'Libre Baskerville',
    family: '"Libre Baskerville", Baskerville, "Baskerville Old Face", serif',
    desc: 'Crisp transitional serif',
  },
  atkinson: {
    label: 'Atkinson Hyperlegible',
    family: '"Atkinson Hyperlegible", system-ui, sans-serif',
    desc: 'High-contrast accessible',
  },
}

export const THEMES: { id: Theme; name: string; bg: string; ink: string }[] = [
  { id: 'cream', name: 'Chamois Cream', bg: '#F9F6EE', ink: '#2B2523' },
  { id: 'parchment', name: 'Muted Linen', bg: '#F4EFEA', ink: '#262322' },
  { id: 'sage', name: 'Library Sage', bg: '#EAEFE9', ink: '#202B24' },
  { id: 'midnight', name: 'Midnight Study', bg: '#181615', ink: '#D8D2C4' },
]

export const iconBtn =
  'grid size-9 place-items-center rounded-sm text-soft transition hover:bg-line hover:text-ink focus-visible:bg-line'

export function Customizer() {
  const [open, setOpen] = useState(false)
  const prefs = useStore((s) => s.prefs)
  const book = useStore((s) => s.book)
  const { setPrefs, updateBook } = useStore.getState()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={iconBtn}
        aria-label="Typography and ambience settings"
        aria-expanded={open}
        title="Reading settings"
      >
        <SlidersHorizontal size={18} strokeWidth={1.6} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Reading customizer"
          className="grain absolute right-0 top-12 z-50 w-80 rounded-sm bg-card p-5 shadow-2xl ring-1 ring-line animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="smallcaps text-base font-semibold tracking-wider">Sanctuary Settings</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPrefs(DEFAULT_PREFS)}
                className="p-1 text-soft transition hover:text-ink"
                title="Reset defaults"
                aria-label="Reset default settings"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-soft transition hover:text-ink"
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-5 pt-4 text-xs">
            {/* Paper Theme */}
            <div>
              <label className="smallcaps mb-2 block font-semibold text-soft">Paper Stock</label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setPrefs({ theme: t.id })}
                    style={{ backgroundColor: t.bg, color: t.ink }}
                    className={`flex items-center gap-2 rounded border px-3 py-2 text-left font-serif transition ${
                      prefs.theme === t.id
                        ? 'border-accent shadow-sm ring-1 ring-accent'
                        : 'border-line hover:border-soft'
                    }`}
                  >
                    <span
                      className="size-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: t.bg }}
                    />
                    <span className="truncate text-[13px]">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div>
              <label className="smallcaps mb-2 block font-semibold text-soft">Typeface</label>
              <div className="space-y-1.5">
                {(Object.keys(FONTS) as Font[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPrefs({ font: f })}
                    style={{ fontFamily: FONTS[f].family }}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition ${
                      prefs.font === f
                        ? 'border-accent bg-paper/60 ring-1 ring-accent'
                        : 'border-line hover:bg-paper/30'
                    }`}
                  >
                    <span className="text-sm">{FONTS[f].label}</span>
                    <span className="text-[11px] font-sans text-soft">{FONTS[f].desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders: Size, Leading, Measure */}
            <div className="space-y-3 rounded bg-paper/50 p-3 border border-line">
              <div>
                <div className="flex justify-between text-soft">
                  <span className="smallcaps">Type Size</span>
                  <span>{prefs.size}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="26"
                  step="1"
                  value={prefs.size}
                  onChange={(e) => setPrefs({ size: Number(e.target.value) })}
                  className="mt-1 w-full accent-accent cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-soft">
                  <span className="smallcaps">Line Height</span>
                  <span>{prefs.leading.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min="1.4"
                  max="2.1"
                  step="0.05"
                  value={prefs.leading}
                  onChange={(e) => setPrefs({ leading: Number(e.target.value) })}
                  className="mt-1 w-full accent-accent cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-soft">
                  <span className="smallcaps">Line Width</span>
                  <span>{prefs.measure}ch</span>
                </div>
                <input
                  type="range"
                  min="52"
                  max="78"
                  step="2"
                  value={prefs.measure}
                  onChange={(e) => setPrefs({ measure: Number(e.target.value) })}
                  className="mt-1 w-full accent-accent cursor-pointer"
                />
              </div>
            </div>

            {/* Book Annotation Legend */}
            {book && (
              <div>
                <label className="smallcaps mb-2 block font-semibold text-soft">
                  Highlighter Key (Active Book)
                </label>
                <div className="space-y-1.5">
                  {INKS.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <span className="blot size-4 shrink-0" style={ink(c)} />
                      <input
                        type="text"
                        value={book.legend[c] || ''}
                        onChange={(e) =>
                          updateBook({
                            legend: { ...book.legend, [c]: e.target.value },
                          })
                        }
                        placeholder={c}
                        className="w-full border-b border-line bg-transparent px-1 py-0.5 text-xs outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
