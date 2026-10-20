import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, Download, Search, MessageSquareQuote, FileText, Sparkles, Printer } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Ink, type Style } from '../lib/db.ts'
import { formatQuote, toMarkdown, cite, normalizeText } from '../lib/text.ts'
import { goToPage } from './Reader.tsx'
import { ink } from './Page.tsx'

export function Quotebook() {
  const drawer = useStore((s) => s.drawer)
  const book = useStore((s) => s.book)
  const notes = useStore((s) => s.notes)
  const prefs = useStore((s) => s.prefs)
  const { toggleDrawer, setPrefs, removeNote } = useStore.getState()

  const [query, setQuery] = useState('')
  const [filterInk, setFilterInk] = useState<Ink | 'all'>('all')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [copiedExport, setCopiedExport] = useState(false)

  const activeStyle = prefs.style

  // Sequential reading order (by page, then by offset)
  const filtered = useMemo(() => {
    let list = [...notes].sort((a, b) => a.page - b.page || a.start - b.start)
    if (filterInk !== 'all') {
      list = list.filter((n) => n.color === filterInk)
    }
    if (query.trim()) {
      const q = normalizeText(query)
      list = list.filter(
        (n) => normalizeText(n.quote).includes(q) || normalizeText(n.note).includes(q),
      )
    }
    return list
  }, [notes, filterInk, query])

  const exportMarkdown = useMemo(() => {
    if (!book) return ''
    return toMarkdown(book, notes, activeStyle)
  }, [book, notes, activeStyle])

  if (!book) return null

  const handleCopyCitation = async (noteId: string, quote: string, page: number, style: Style) => {
    const formatted = formatQuote(style, quote, book, page + 1)
    await navigator.clipboard.writeText(formatted.text)
    const key = `${noteId}:${style}`
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleDownloadMarkdown = () => {
    const blob = new Blob([exportMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Quotebook.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyExportMarkdown = async () => {
    await navigator.clipboard.writeText(exportMarkdown)
    setCopiedExport(true)
    setTimeout(() => setCopiedExport(false), 2000)
  }

  const STYLES: { id: Style; label: string; desc: string }[] = [
    { id: 'mla', label: 'MLA 9', desc: '(Author 42)' },
    { id: 'apa', label: 'APA 7', desc: '(Author, Year, p. 42)' },
    { id: 'chicago', label: 'Chicago', desc: 'Author, Title, 42.' },
  ]

  return (
    <>
      {/* Backdrop for click outside (isolated overlay) */}
      <div
        onClick={() => toggleDrawer(false)}
        className={`fixed inset-0 z-30 bg-ink/10 backdrop-blur-[1px] transition-opacity duration-300 ${
          drawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label="Quotebook & Academic Synthesis"
        className={`grain fixed inset-y-0 right-0 z-40 flex w-full max-w-[min(480px,90vw)] min-h-dvh flex-col border-l border-line bg-card shadow-2xl transition-transform duration-300 ease-out will-change-transform ${
          drawer ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Header (p-6 standard) */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <MessageSquareQuote size={18} strokeWidth={1.5} className="text-accent" />
            <h2 className="smallcaps text-base font-semibold tracking-wider">The Quotebook</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs text-soft transition hover:bg-paper hover:text-ink hover:border-soft"
              title="Print 2-column Socratic Seminar cheat sheet for class"
            >
              <Printer size={13} strokeWidth={1.5} />
              <span className="smallcaps font-sans">Seminar Sheet</span>
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs text-soft transition hover:bg-paper hover:text-ink hover:border-soft"
              title="Preview and export Markdown / Obsidian study guide"
            >
              <Download size={13} strokeWidth={1.5} />
              <span className="smallcaps font-sans">Export .md</span>
            </button>
            <button
              onClick={() => toggleDrawer(false)}
              className="p-1 text-soft transition hover:text-ink"
              aria-label="Close Quotebook"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Global Citation Style Preference Bar */}
        <div className="border-b border-line bg-paper/60 px-6 py-2.5">
          <div className="flex items-center justify-between">
            <span className="smallcaps text-[11px] font-semibold text-soft">Default Style:</span>
            <div className="flex rounded-sm border border-line p-0.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setPrefs({ style: s.id })}
                  className={`rounded-xs px-2.5 py-0.5 text-xs transition ${
                    activeStyle === s.id
                      ? 'bg-ink font-semibold text-paper'
                      : 'text-soft hover:text-ink'
                  }`}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter and Search */}
        <div className="space-y-2.5 border-b border-line px-6 py-4">
          <div className="relative">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-2.5 text-soft" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search quotes, marginalia, motifs..."
              className="w-full rounded-sm border border-line bg-paper/50 py-1.5 pl-9 pr-3 text-xs text-ink placeholder:text-soft/60 outline-none focus:border-accent"
            />
          </div>

          {/* Ink color filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
            <button
              onClick={() => setFilterInk('all')}
              className={`rounded-sm px-2.5 py-1 smallcaps transition ${
                filterInk === 'all' ? 'bg-line text-ink font-semibold' : 'text-soft hover:text-ink'
              }`}
            >
              All ({notes.length})
            </button>
            {INKS.map((c) => {
              const count = notes.filter((n) => n.color === c).length
              if (count === 0 && filterInk !== c) return null
              const label = book.legend[c] || c
              return (
                <button
                  key={c}
                  onClick={() => setFilterInk(c === filterInk ? 'all' : c)}
                  style={ink(c)}
                  className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 transition ${
                    filterInk === c ? 'bg-line text-ink font-semibold' : 'text-soft hover:text-ink'
                  }`}
                >
                  <span className="blot size-2.5" style={ink(c)} />
                  <span className="truncate max-w-[80px]">{label}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quotes Stream (p-6 standard body padding) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-soft">
              <FileText size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-40" />
              <p className="font-serif italic text-sm">No annotations found.</p>
              <p className="mt-1 text-xs">Select text in the prose to begin gathering thoughts.</p>
            </div>
          ) : (
            filtered.map((n) => {
              const legendLabel = book.legend[n.color] || n.color

              return (
                <article
                  key={n.id}
                  style={ink(n.color)}
                  className="group relative rounded-sm border border-line bg-paper/60 p-4 text-xs shadow-xs transition hover:bg-paper hover:shadow-sm"
                >
                  {/* Top row: Chapter / Page number badge + Highlighter color dot */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-line/50 text-soft">
                    <button
                      onClick={() => goToPage(n.page)}
                      className="flex items-center gap-1.5 font-sans font-medium text-ink hover:text-accent transition"
                      title={`Jump to page ${n.page + 1}`}
                    >
                      <span className="smallcaps text-[11px] bg-line/40 px-2 py-0.5 rounded-sm hover:underline">
                        Page {n.page + 1}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="blot size-2.5"
                        style={ink(n.color)}
                        title={legendLabel}
                      />
                      <span className="smallcaps text-[10px] text-soft font-semibold">{legendLabel}</span>
                    </div>
                  </div>

                  {/* Middle: Extracted passage enclosed in classic typographical curly quotes (“ ”) */}
                  <blockquote
                    className="font-serif italic text-ink text-[13px] leading-relaxed border-l-2 pl-3 my-2.5"
                    style={{ borderColor: `rgb(var(--${n.color}))` }}
                  >
                    “{n.quote}”
                  </blockquote>

                  {/* Student's marginal commentary if exists */}
                  {n.note.trim() && (
                    <div className="mt-2.5 rounded-sm bg-card/90 p-2.5 font-hand text-[15px] leading-tight text-ink border border-line/60">
                      {n.note}
                    </div>
                  )}

                  {/* Bottom row: 1-click citation copy button (MLA, APA, Chicago pills) + Delete */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/40">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-soft/80 smallcaps mr-1">Cite:</span>
                      {(['mla', 'apa', 'chicago'] as Style[]).map((st) => {
                        const isCopied = copiedKey === `${n.id}:${st}`
                        return (
                          <button
                            key={st}
                            onClick={() => handleCopyCitation(n.id, n.quote, n.page, st)}
                            className={`flex items-center gap-1 rounded-sm px-2 py-0.5 font-sans text-[10px] uppercase font-semibold border transition ${
                              isCopied
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-card text-soft border-line hover:text-ink hover:border-soft'
                            }`}
                            title={`Copy ${st.toUpperCase()} citation`}
                          >
                            {isCopied ? <Check size={10} strokeWidth={1.5} className="text-green-500" /> : null}
                            <span>{isCopied ? 'Copied' : st}</span>
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => removeNote(n.id)}
                      className="rounded p-1 text-soft opacity-40 hover:opacity-100 hover:text-accent transition"
                      title="Delete annotation"
                    >
                      <X size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        {/* Footer (p-6 standard) */}
        <footer className="border-t border-line bg-paper/80 px-6 py-4 text-center text-xs text-soft">
          <span className="smallcaps">
            {filtered.length} of {notes.length} marginalia · Hotkey: ⌘J / Ctrl+J
          </span>
        </footer>
      </aside>

      {/* Export Preview Modal */}
      {showExportModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
            onClick={() => setShowExportModal(false)}
          >
            <div
              className="grain w-full max-w-2xl rounded-sm border border-line bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} strokeWidth={1.5} className="text-accent" />
                  <h3 className="smallcaps text-base font-semibold">Markdown / Obsidian Export Preview</h3>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1 text-soft hover:text-ink"
                  aria-label="Close export preview"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <p className="font-serif italic text-xs text-soft mb-3">
                Formatted study guide with live citations, marginalia thoughts, and thematic tags ready for Obsidian or your notes app:
              </p>

              <pre className="max-h-80 overflow-y-auto rounded-sm border border-line bg-paper/60 p-4 font-mono text-[11px] leading-relaxed text-ink select-all whitespace-pre-wrap">
                {exportMarkdown}
              </pre>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-[11px] text-soft">
                  {notes.length} annotations formatted in {activeStyle.toUpperCase()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyExportMarkdown}
                    className="flex items-center gap-1.5 rounded-sm border border-line px-4 py-2 font-serif text-xs text-ink hover:bg-paper transition"
                  >
                    {copiedExport ? <Check size={14} strokeWidth={1.5} className="text-green-600" /> : <Copy size={14} strokeWidth={1.5} />}
                    <span>{copiedExport ? 'Copied to Clipboard' : 'Copy to Clipboard'}</span>
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="flex items-center gap-1.5 rounded-sm bg-ink px-4 py-2 font-serif text-xs text-paper shadow-xs hover:opacity-90 transition"
                  >
                    <Download size={14} strokeWidth={1.5} />
                    <span>Download .md</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Socratic Seminar Prep Sheet Modal */}
      {showPrintModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
            onClick={() => setShowPrintModal(false)}
          >
            <div
              className="grain w-full max-w-3xl rounded-sm border border-line bg-card p-6 shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Printer size={18} strokeWidth={1.5} className="text-accent" />
                  <h3 className="smallcaps text-base font-semibold">Printable Socratic Seminar Prep Sheet</h3>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 text-soft hover:text-ink cursor-pointer"
                  aria-label="Close print preview"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <p className="font-serif italic text-xs text-soft mb-3 shrink-0">
                Optimized 2-column physical handout for in-class seminars: quotes and citations on left, margin reflections and motifs on right.
              </p>

              {/* Sheet Preview Body */}
              <div className="flex-1 overflow-y-auto border border-line bg-paper/60 p-6 rounded-sm space-y-4">
                <div className="border-b-2 border-ink pb-3 mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <h4 className="font-serif text-lg font-bold text-ink">{book.title}</h4>
                    <span className="text-xs text-soft">by {book.author} ({book.year})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-soft border-t border-line pt-2">
                    <div>Student: <span className="border-b border-line inline-block w-28"></span></div>
                    <div>Date: <span className="border-b border-line inline-block w-20"></span></div>
                    <div>Course: <span className="border-b border-line inline-block w-20"></span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="font-semibold text-soft smallcaps border-b border-line pb-1">
                    Passage & Academic Citation ({activeStyle.toUpperCase()})
                  </div>
                  <div className="font-semibold text-soft smallcaps border-b border-line pb-1">
                    Student Marginalia & Thematic Motifs
                  </div>
                </div>

                <div className="space-y-3">
                  {filtered.map((n) => (
                    <div key={n.id} className="grid grid-cols-2 gap-4 text-xs border-b border-line/50 pb-3">
                      <div>
                        <blockquote className="font-serif italic text-ink mb-1">
                          “{n.quote}”
                        </blockquote>
                        <span className="font-sans text-[11px] text-accent">
                          {cite(activeStyle, book, n.page + 1).text} (p. {n.page + 1})
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-[11px] font-sans font-medium text-soft">
                          <span className="blot size-2" style={ink(n.color)} />
                          <span>#{book.legend[n.color] || n.color}</span>
                        </div>
                        <p className="font-sans text-ink leading-relaxed">
                          {n.note || <span className="italic text-soft/60">No additional note</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-4 shrink-0">
                <span className="text-[11px] text-soft">
                  {filtered.length} entries ready for print
                </span>
                <button
                  onClick={() => {
                    setShowPrintModal(false)
                    setTimeout(() => window.print(), 100)
                  }}
                  className="flex items-center gap-1.5 rounded-sm bg-ink px-4 py-2 font-serif text-xs text-paper shadow-xs hover:opacity-90 transition cursor-pointer"
                >
                  <Printer size={14} strokeWidth={1.5} />
                  <span>Print Seminar Handout</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Standalone Pure Print Layout for @media print */}
      <div id="seminar-print-sheet" className="hidden print:block font-serif text-black p-8 bg-white">
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-baseline mb-2">
            <h1 className="text-2xl font-bold">{book.title}</h1>
            <span className="text-sm">by {book.author} ({book.year})</span>
          </div>
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-4">
            Inkling Literature Sanctuary — Socratic Seminar Evidence Sheet
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm border-t border-gray-300 pt-3">
            <div>Student Name: ___________________________</div>
            <div>Date: _______________</div>
            <div>Period / Section: ___________</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-xs font-bold uppercase tracking-wider border-b-2 border-black pb-2 mb-4">
          <div>Primary Evidence & Academic Citation ({activeStyle.toUpperCase()})</div>
          <div>Student Analysis & Thematic Motifs</div>
        </div>

        <div className="space-y-4">
          {filtered.map((n) => (
            <div key={n.id} className="grid grid-cols-2 gap-6 text-sm border-b border-gray-200 pb-4 break-inside-avoid">
              <div>
                <blockquote className="italic mb-1.5 leading-relaxed">
                  “{n.quote}”
                </blockquote>
                <div className="text-xs text-gray-700 font-sans">
                  {cite(activeStyle, book, n.page + 1).text} (Page {n.page + 1})
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 mb-1">
                  Motif: #{book.legend[n.color] || n.color}
                </div>
                <div className="text-sm leading-relaxed text-gray-900">
                  {n.note || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
