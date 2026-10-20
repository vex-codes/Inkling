import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, X, RotateCcw, Download, FileDown, Headphones, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Font, type Theme, DEFAULT_PREFS } from '../lib/db.ts'
import { ink } from './Page.tsx'
import { sanctuaryAudio, type SoundscapeType } from '../lib/audio.ts'

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
  libron: {
    label: 'Libron',
    family: '"Libron", Georgia, serif',
    desc: 'Bespoke literary serif',
  },
  dyslexic: {
    label: 'OpenDyslexic',
    family: '"OpenDyslexic", "Atkinson Hyperlegible", sans-serif',
    desc: 'Weighted bottoms for reading clarity',
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

  const [soundscape, setSoundscapeState] = useState<SoundscapeType>(sanctuaryAudio.getSoundscape())
  const [ambientVol, setAmbientVol] = useState(sanctuaryAudio.getVolume())

  const handleSelectSoundscape = (type: SoundscapeType) => {
    setSoundscapeState(type)
    sanctuaryAudio.setSoundscape(type)
  }

  const handleVolumeChange = (vol: number) => {
    setAmbientVol(vol)
    sanctuaryAudio.setVolume(vol)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
        <SlidersHorizontal size={18} strokeWidth={1.5} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sanctuary settings"
            onClick={(e) => e.stopPropagation()}
            className="settings-modal-dialog grain rounded-sm border border-line bg-card shadow-2xl ring-1 ring-line/50 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Fixed Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
              <h2 className="smallcaps text-base font-semibold tracking-wider">Sanctuary Settings</h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-soft/60 uppercase">Esc</span>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 text-soft transition hover:text-ink"
                  aria-label="Close settings"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="settings-modal-body space-y-5 text-xs">
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
              <div className="space-y-3 rounded bg-paper/50 p-3.5 border border-line">
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

              {/* Offline Procedural Ambient Soundscapes (Web Audio API) */}
              <div className="border-t border-line pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="smallcaps block font-semibold text-soft">
                    Offline Soundscapes
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectSoundscape('off')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-sm border text-xs transition cursor-pointer ${
                      soundscape === 'off'
                        ? 'border-accent bg-paper font-semibold text-accent shadow-xs'
                        : 'border-line bg-paper/40 text-soft hover:bg-paper hover:text-ink'
                    }`}
                  >
                    <VolumeX size={15} />
                    <span className="text-xs">Silent</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSoundscape('lofi')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-sm border text-xs transition cursor-pointer ${
                      soundscape === 'lofi'
                        ? 'border-accent bg-paper font-semibold text-accent shadow-xs'
                        : 'border-line bg-paper/40 text-soft hover:bg-paper hover:text-ink'
                    }`}
                  >
                    <Headphones size={15} />
                    <span className="text-xs">Lo-Fi Beats</span>
                  </button>
                </div>

                {soundscape === 'lofi' && (
                  <div className="flex items-center gap-2 px-1">
                    <Volume2 size={12} className="text-soft shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={ambientVol}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-full accent-accent cursor-pointer"
                    />
                    <span className="text-[11px] text-soft font-mono w-7 text-right">
                      {Math.round(ambientVol * 100)}%
                    </span>
                  </div>
                )}
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

              {/* Sanctuary Data Management */}
              <div className="border-t border-line pt-3">
                <label className="smallcaps mb-2 block font-semibold text-soft">Data & Sanctuary</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const json = await useStore.getState().backupSanctuary()
                      const blob = new Blob([json], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `Inkling_Sanctuary_Backup_${new Date().toISOString().slice(0, 10)}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-line bg-paper/60 px-3 py-2 text-xs text-soft transition hover:bg-paper hover:text-ink hover:border-soft"
                    title="Export complete library backup"
                  >
                    <Download size={13} strokeWidth={1.5} />
                    <span>Backup .json</span>
                  </button>

                  <label className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-line bg-paper/60 px-3 py-2 text-xs text-soft transition hover:bg-paper hover:text-ink hover:border-soft cursor-pointer">
                    <FileDown size={13} strokeWidth={1.5} />
                    <span>Restore</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (f) {
                          const txt = await f.text()
                          await useStore.getState().restoreSanctuary(txt)
                          setOpen(false)
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Pinned Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-line bg-paper/60 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setPrefs(DEFAULT_PREFS)}
                className="flex items-center gap-1.5 text-xs text-soft hover:text-accent transition"
                title="Reset defaults"
              >
                <RotateCcw size={13} strokeWidth={1.5} />
                <span className="smallcaps">Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm bg-ink px-4 py-1.5 font-serif text-xs text-paper shadow-xs hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
