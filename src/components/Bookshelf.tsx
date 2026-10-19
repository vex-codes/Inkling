import { useState, useRef, type DragEvent } from 'react'
import { Plus, BookOpen, Trash2, Upload, Sparkles, Feather } from 'lucide-react'
import { useStore } from '../store.ts'
import { ACCEPT } from '../lib/ingest.ts'
import { Customizer } from './Customizer.tsx'

const CLOTH_PALETTES = [
  '#4a151b', // Burgundy
  '#1b3323', // Forest Library
  '#1a243a', // Oxford Navy
  '#543818', // Antique Ochre
  '#2d241e', // Dark Espresso
]

export function Bookshelf() {
  const books = useStore((s) => s.books)
  const { openBook, removeBook, addBook } = useStore.getState()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setIsUploading(true)
    try {
      await addBook(file)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to ingest document')
    } finally {
      setIsUploading(false)
    }
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative min-h-dvh flex flex-col justify-between"
    >
      {/* Top Sanctuary Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-sm bg-ink text-paper shadow-sm">
            <Feather size={19} strokeWidth={1.7} />
          </div>
          <div>
            <h1 className="font-serif text-xl font-medium tracking-tight">Inkling</h1>
            <p className="smallcaps text-xs text-soft">Digital Reading & Marginalia Sanctuary</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Customizer />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded bg-ink px-3.5 py-1.5 font-serif text-sm text-paper shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2} />
            <span>{isUploading ? 'Ingesting…' : 'Shelve Book'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
            className="hidden"
          />
        </div>
      </header>

      {/* Main Sanctuary Shelf */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {/* Banner quote */}
        <div className="mb-10 text-center">
          <p className="font-serif text-lg italic text-soft">
            “Where your best thoughts begin in the margins.”
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-soft/70">
            <span className="smallcaps">Local-First Storage</span>
            <span>·</span>
            <span className="smallcaps">EPUB, PDF & Markdown</span>
            <span>·</span>
            <span className="smallcaps">Instant MLA/APA Citations</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded bg-rose-900/10 p-3 text-center text-xs text-red-800 border border-rose-300">
            {error}
          </div>
        )}

        {/* The Bookshelf Rack */}
        <div className="shelf-cell">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((b, index) => {
              const cloth = CLOTH_PALETTES[index % CLOTH_PALETTES.length]
              const progress = Math.round(((b.page + 1) / (b.pageCount || 1)) * 100)
              const estMinutes = Math.max(1, Math.round(b.wordCount / 220))

              return (
                <div
                  key={b.id}
                  className="group relative flex flex-col items-center cursor-pointer transition-transform duration-200 hover:-translate-y-2"
                  onClick={() => openBook(b.id)}
                >
                  {/* Book Spine / Cover */}
                  <div
                    style={{ '--cloth': cloth } as React.CSSProperties}
                    className="cloth relative aspect-[2/3] w-full max-w-[190px] overflow-hidden p-4 flex flex-col justify-between"
                  >
                    {/* Ribbon Bookmark */}
                    <div className="ribbon absolute top-0 right-4 h-12 w-4 bg-accent shadow-sm" />

                    {/* Gold Foil Title & Author */}
                    <div className="pt-3 text-center">
                      <div className="mb-2 flex justify-center">
                        <BookOpen size={18} className="text-[#ecd38f]/80" strokeWidth={1.5} />
                      </div>
                      <h3 className="foil font-serif text-sm font-bold leading-snug line-clamp-3">
                        {b.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-serif italic text-[#f5e6b0]/90 truncate">
                        {b.author || 'Anonymous'}
                      </p>
                    </div>

                    {/* Book base metadata */}
                    <div className="border-t border-white/10 pt-2 text-center text-[10px] text-white/70">
                      <span className="smallcaps tracking-wider uppercase">{b.format}</span>
                      <span> · </span>
                      <span>{b.pageCount} pp.</span>
                    </div>
                  </div>

                  {/* Under-book metadata: Progress Ribbon & Actions */}
                  <div className="mt-2.5 w-full max-w-[190px] px-1 text-center">
                    <div className="flex items-center justify-between text-[11px] text-soft">
                      <span className="font-sans font-medium">{progress}% read</span>
                      <span>~{estMinutes}m left</span>
                    </div>

                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="smallcaps text-[10px] text-soft">
                        {b.flags?.length ? `${b.flags.length} flags` : 'Open'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Remove "${b.title}" from your library?`)) {
                            removeBook(b.id)
                          }
                        }}
                        className="p-1 text-soft hover:text-accent transition"
                        title="Remove book"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Ingestion Drop Target Card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group flex aspect-[2/3] w-full max-w-[190px] flex-col items-center justify-center rounded-sm border-2 border-dashed border-line bg-paper/30 p-4 text-center cursor-pointer transition hover:border-accent hover:bg-paper/60"
            >
              <div className="grid size-11 place-items-center rounded-full bg-line/60 text-soft group-hover:text-accent group-hover:scale-105 transition">
                <Upload size={20} strokeWidth={1.6} />
              </div>
              <h4 className="mt-3 font-serif text-sm font-medium text-ink">Add New Work</h4>
              <p className="mt-1 text-[11px] text-soft">Drag & drop EPUB, PDF, or Markdown here</p>
            </div>
          </div>
        </div>
      </main>

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-desk/85 backdrop-blur-sm border-4 border-dashed border-accent">
          <Sparkles size={48} className="text-accent animate-bounce" />
          <h2 className="mt-4 font-serif text-2xl font-medium text-ink">Drop your text onto the shelf</h2>
          <p className="mt-1 smallcaps text-sm text-soft">Inkling will bind and catalog it immediately</p>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-line py-4 text-center text-xs text-soft">
        <p className="smallcaps">
          Inkling Literature Sanctuary · All books & annotations stored locally in IndexedDB
        </p>
      </footer>
    </div>
  )
}
