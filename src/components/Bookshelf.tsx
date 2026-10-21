import { useState, useRef, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  BookOpen,
  Upload,
  Sparkles,
  Feather,
  MoreVertical,
  Edit3,
  Download,
  Trash2,
  FileDown,
  RotateCcw,
  BookMarked,
  X,
  AlertCircle,
  FolderArchive,
} from 'lucide-react'
import { useStore } from '../store.ts'
import { ACCEPT } from '../services/bookIngestion.ts'
import { Customizer } from './Customizer.tsx'
import { type Book } from '../lib/db.ts'
import { exportBookArchive, exportStudyNotesMarkdown } from '../services/backupService.ts'

const CLOTH_PALETTES = [
  '#4a151b', // Burgundy
  '#1b3323', // Forest Library
  '#1a243a', // Oxford Navy
  '#543818', // Antique Ochre
  '#2d241e', // Dark Espresso
]

export function Bookshelf() {
  const books = useStore((s) => s.books)
  const isSaving = useStore((s) => s.isSaving)
  const storageWarning = useStore((s) => s.storageWarning)
  const { openBook, stageRemoveBook, addBook, importBinder, renameBook, reseedSample, backupSanctuary, restoreSanctuary } =
    useStore.getState()

  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRestoringBinder, setIsRestoringBinder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameAuthor, setRenameAuthor] = useState('')
  const [renameYear, setRenameYear] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    const isBinder = file.name.toLowerCase().endsWith('.inkling')
    if (isBinder) {
      setIsRestoringBinder(true)
    } else {
      setIsUploading(true)
    }
    try {
      if (file.size === 0) {
        throw new Error('This document is empty (0 bytes). Please select a valid EPUB, PDF, Markdown, or .inkling binder file.')
      }
      if (isBinder) {
        await importBinder(file)
      } else {
        await addBook(file)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to ingest document')
    } finally {
      setIsUploading(false)
      setIsRestoringBinder(false)
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

  const handleOpenRename = (b: Book) => {
    setEditingBook(b)
    setRenameTitle(b.title)
    setRenameAuthor(b.author)
    setRenameYear(b.year || '')
    setActiveMenuId(null)
  }

  const handleSaveRename = async () => {
    if (!editingBook || !renameTitle.trim()) return
    await renameBook(editingBook.id, renameTitle.trim(), renameAuthor.trim(), renameYear.trim())
    setEditingBook(null)
  }

  const handleExportBinder = async (b: Book) => {
    setActiveMenuId(null)
    try {
      await exportBookArchive(b.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export digital binder')
    }
  }

  const handleExportNotes = async (b: Book) => {
    setActiveMenuId(null)
    try {
      await exportStudyNotesMarkdown(b.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export study notes')
    }
  }

  const handleDownloadBackup = async () => {
    const json = await backupSanctuary()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Inkling_Sanctuary_Backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRestoreBackup = async (file: File) => {
    try {
      setError(null)
      const text = await file.text()
      await restoreSanctuary(text)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to restore sanctuary backup')
    }
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative min-h-dvh flex flex-col justify-between selection:bg-accent/20"
      onClick={() => setActiveMenuId(null)}
    >
      {/* Top Sanctuary Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-sm bg-ink text-paper shadow-sm">
            <Feather size={19} strokeWidth={1.7} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl font-medium tracking-tight">Inkling</h1>
              {isSaving && (
                <span className="flex items-center gap-1 font-serif text-[11px] text-soft animate-pulse">
                  <span className="size-1.5 rounded-full bg-accent" />
                  <span>binding…</span>
                </span>
              )}
            </div>
            <p className="smallcaps text-xs text-soft">Digital Reading & Marginalia Sanctuary</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sanctuary Backup & Restore */}
          <button
            onClick={handleDownloadBackup}
            className="hidden sm:flex items-center gap-1 rounded border border-line px-2.5 py-1 text-xs text-soft transition hover:bg-paper hover:text-ink"
            title="Download Sanctuary Backup (.json)"
          >
            <Download size={13} />
            <span className="smallcaps">Backup (.json)</span>
          </button>

          <button
            onClick={() => restoreInputRef.current?.click()}
            className="hidden sm:flex items-center gap-1 rounded border border-line px-2.5 py-1 text-xs text-soft transition hover:bg-paper hover:text-ink"
            title="Restore Sanctuary from .json backup"
          >
            <FileDown size={13} />
            <span className="smallcaps">Restore</span>
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleRestoreBackup(f)
            }}
            className="hidden"
          />

          <Customizer />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded bg-ink px-3.5 py-1.5 font-serif text-sm text-paper shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2} />
            <span>{isUploading ? 'Binding…' : 'Shelve Book'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
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
            <span className="smallcaps">Living Marginalia Rail</span>
            <span>·</span>
            <span className="smallcaps">Instant Academic Citations</span>
          </div>
        </div>

        {isRestoringBinder && (
          <div className="mb-6 flex items-center justify-center gap-2.5 rounded bg-amber-500/10 p-3.5 text-xs text-amber-950 border border-amber-300/80 animate-pulse shadow-xs">
            <span className="size-2 rounded-full bg-accent animate-ping" />
            <span className="font-serif text-sm font-medium">Restoring Binder… hydrating marginalia and reading progress</span>
          </div>
        )}

        {isUploading && !isRestoringBinder && (
          <div className="mb-6 flex items-center justify-center gap-2.5 rounded bg-ink/5 p-3 text-xs text-soft border border-line animate-pulse">
            <span className="size-2 rounded-full bg-soft" />
            <span className="font-serif text-sm">Binding document into your sanctuary…</span>
          </div>
        )}

        {storageWarning && (
          <div className="mb-6 flex items-center justify-center gap-2 rounded bg-amber-500/10 p-3 text-xs text-amber-900 border border-amber-300">
            <AlertCircle size={15} />
            <span>{storageWarning}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded bg-rose-900/10 p-3 text-center text-xs text-red-800 border border-rose-300">
            {error}
          </div>
        )}

        {/* The Bookshelf Rack */}
        <div className="shelf-cell">
          {books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-paper text-soft shadow-inner">
                <BookMarked size={28} strokeWidth={1.4} />
              </div>
              <h3 className="mt-4 font-serif text-lg font-medium text-ink">Your bookshelf is quiet</h3>
              <p className="mt-1 text-xs text-soft max-w-sm">
                Shelve a new classic by dropping an EPUB, PDF, or Markdown file here, or restore the initial Gatsby sample.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-ink px-4 py-2 font-serif text-xs text-paper shadow-xs transition hover:opacity-90"
                >
                  Shelve a Document
                </button>
                <button
                  onClick={() => void reseedSample()}
                  className="flex items-center gap-1.5 rounded border border-line bg-paper px-4 py-2 font-serif text-xs text-soft shadow-2xs transition hover:text-ink"
                >
                  <RotateCcw size={13} />
                  <span>Restore Gatsby Sample</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {books.map((b, index) => {
                const cloth = CLOTH_PALETTES[index % CLOTH_PALETTES.length]
                const progress = Math.round(((b.page + 1) / (b.pageCount || 1)) * 100)
                const estMinutes = Math.max(1, Math.round(b.wordCount / 220))
                const isMenuOpen = activeMenuId === b.id

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

                      <div className="mt-2 flex items-center justify-between">
                        <span className="smallcaps text-[10px] text-soft">
                          {b.flags?.length ? `${b.flags.length} flags` : 'Open'}
                        </span>

                        {/* Three-dot Contextual Menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveMenuId(isMenuOpen ? null : b.id)
                            }}
                            className="rounded p-1 text-soft transition hover:bg-line hover:text-ink focus-visible:bg-line"
                            title="Book options"
                            aria-label="Book options menu"
                            aria-expanded={isMenuOpen}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="grain absolute right-0 bottom-full mb-1 z-30 w-56 rounded border border-line bg-card p-1 shadow-xl animate-in fade-in zoom-in-95 text-left"
                            >
                              <button
                                onClick={() => void handleExportBinder(b)}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition hover:bg-paper font-medium"
                              >
                                <FolderArchive size={13} className="text-accent" />
                                <span>Export Digital Binder (.inkling)</span>
                              </button>

                              <button
                                onClick={() => void handleExportNotes(b)}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition hover:bg-paper"
                              >
                                <FileDown size={13} className="text-soft" />
                                <span>Export Notes to Markdown (.md)</span>
                              </button>

                              <button
                                onClick={() => handleOpenRename(b)}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition hover:bg-paper"
                              >
                                <Edit3 size={13} className="text-soft" />
                                <span>Details / Rename</span>
                              </button>

                              <div className="my-1 border-t border-line/50" />

                              <button
                                onClick={() => {
                                  setActiveMenuId(null)
                                  void stageRemoveBook(b.id)
                                }}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[#8C3B2E] transition hover:bg-red-500/10 font-medium"
                              >
                                <Trash2 size={13} />
                                <span>Delete Book</span>
                              </button>
                            </div>
                          )}
                        </div>
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
                <p className="mt-1 text-[11px] text-soft">Drag & drop EPUB, PDF, Markdown, or .inkling</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Rename Book Modal */}
      {editingBook &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
            onClick={() => setEditingBook(null)}
          >
            <div
              className="grain w-full max-w-sm rounded-sm border border-line bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
                <h3 className="smallcaps text-base font-semibold">Book Details</h3>
                <button
                  onClick={() => setEditingBook(null)}
                  className="p-1 text-soft hover:text-ink"
                  aria-label="Close dialog"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="smallcaps block text-soft mb-1">Title</label>
                  <input
                    type="text"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    className="w-full rounded-sm border border-line bg-paper px-3 py-2 font-serif text-sm text-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="smallcaps block text-soft mb-1">Author</label>
                  <input
                    type="text"
                    value={renameAuthor}
                    onChange={(e) => setRenameAuthor(e.target.value)}
                    className="w-full rounded-sm border border-line bg-paper px-3 py-2 font-serif text-sm text-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="smallcaps block text-soft mb-1">Publication Year</label>
                  <input
                    type="text"
                    value={renameYear}
                    onChange={(e) => setRenameYear(e.target.value)}
                    placeholder="e.g. 1925"
                    className="w-full rounded-sm border border-line bg-paper px-3 py-2 font-sans text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setEditingBook(null)}
                  className="rounded-sm px-4 py-2 text-xs text-soft hover:text-ink transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSaveRename()}
                  className="rounded-sm bg-ink px-4 py-2 font-serif text-xs text-paper shadow-xs hover:opacity-90 transition"
                >
                  Save Details
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-desk/85 backdrop-blur-sm border-4 border-dashed border-accent">
          <Sparkles size={48} className="text-accent animate-bounce" />
          <h2 className="mt-4 font-serif text-2xl font-medium text-ink">Drop your text onto the shelf</h2>
          <p className="mt-1 smallcaps text-sm text-soft">Inkling will bind and catalog it immediately</p>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-line py-4 text-center text-xs text-soft flex items-center justify-center gap-2">
        <span className="smallcaps">
          Inkling Literature Sanctuary · All books & annotations stored locally in IndexedDB
        </span>
      </footer>
    </div>
  )
}
