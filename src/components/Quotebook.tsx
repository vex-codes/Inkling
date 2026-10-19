import { useMemo, useState } from 'react'
import { X, Copy, Check, Download, Search, MessageSquareQuote, FileText } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Ink, type Style } from '../lib/db.ts'
import { formatQuote, toMarkdown } from '../lib/text.ts'
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState(false)

  const activeStyle = prefs.style

  // Sequential reading order (by page, then by offset)
  const filtered = useMemo(() => {
    let list = [...notes].sort((a, b) => a.page - b.page || a.start - b.start)
    if (filterInk !== 'all') {
      list = list.filter((n) => n.color === filterInk)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (n) => n.quote.toLowerCase().includes(q) || n.note.toLowerCase().includes(q),
      )
    }
    return list
  }, [notes, filterInk, query])

  if (!drawer || !book) return null

  const handleCopyQuote = async (noteId: string, quote: string, page: number) => {
    const formatted = formatQuote(activeStyle, quote, book, page + 1)
    await navigator.clipboard.writeText(formatted.text)
    setCopiedId(noteId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleExportObsidian = () => {
    const md = toMarkdown(book, notes, activeStyle)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Quotebook.md`
    a.click()
    URL.revokeObjectURL(url)
    setExportNotice(true)
    setTimeout(() => setExportNotice(false), 2500)
  }

  const STYLES: { id: Style; label: string; desc: string }[] = [
    { id: 'mla', label: 'MLA 9', desc: '(Author 42)' },
    { id: 'apa', label: 'APA 7', desc: '(Author, Year, p. 42)' },
    { id: 'chicago', label: 'Chicago', desc: 'Author, Title, 42.' },
  ]

  return (
    <aside
      role="complementary"
      aria-label="Quotebook & Academic Synthesis"
      className="grain fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-card shadow-2xl transition-transform duration-300 ease-in-out sm:w-[26rem]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <MessageSquareQuote size={18} className="text-accent" />
          <h2 className="smallcaps text-lg font-semibold tracking-wider">The Quotebook</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportObsidian}
            className="flex items-center gap-1.5 rounded border border-line px-2.5 py-1 text-xs text-soft transition hover:bg-paper hover:text-ink"
            title="Download Obsidian / Markdown study guide"
          >
            {exportNotice ? <Check size={13} className="text-green-600" /> : <Download size={13} />}
            <span className="smallcaps">{exportNotice ? 'Exported' : 'Export .md'}</span>
          </button>
          <button
            onClick={() => toggleDrawer(false)}
            className="p-1 text-soft transition hover:text-ink"
            aria-label="Close Quotebook"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Citation Style Bar */}
      <div className="border-b border-line bg-paper/60 px-5 py-2.5">
        <div className="flex items-center justify-between">
          <span className="smallcaps text-[11px] font-semibold text-soft">Citation Format:</span>
          <div className="flex rounded border border-line p-0.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setPrefs({ style: s.id })}
                className={`rounded px-2.5 py-0.5 text-xs transition ${
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
      <div className="space-y-2 border-b border-line p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-soft" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search quotes, marginalia, motifs..."
            className="w-full rounded border border-line bg-paper/40 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-soft/60 outline-none focus:border-accent"
          />
        </div>

        {/* Ink filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
          <button
            onClick={() => setFilterInk('all')}
            className={`rounded px-2 py-0.5 smallcaps transition ${
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
                className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${
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

      {/* Quotes Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-soft">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="font-serif italic text-sm">No annotations found.</p>
            <p className="mt-1 text-xs">Select text in the prose to begin gathering thoughts.</p>
          </div>
        ) : (
          filtered.map((n) => {
            const citeInfo = formatQuote(activeStyle, n.quote, book, n.page + 1)
            const isCopied = copiedId === n.id
            const legendLabel = book.legend[n.color] || n.color

            return (
              <article
                key={n.id}
                style={ink(n.color)}
                className="group relative rounded border border-line bg-paper/60 p-3 text-xs shadow-sm transition hover:bg-paper hover:shadow"
              >
                {/* Header: Page badge, kind & legend label, jump to page button */}
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-line/50 text-soft">
                  <button
                    onClick={() => goToPage(n.page)}
                    className="flex items-center gap-1.5 font-sans font-medium text-ink hover:text-accent transition"
                    title={`Jump to page ${n.page + 1}`}
                  >
                    <span className="smallcaps text-[11px] underline underline-offset-2">
                      Page {n.page + 1}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span
                      className="blot size-2.5"
                      style={ink(n.color)}
                      title={legendLabel}
                    />
                    <span className="smallcaps text-[10px] text-soft">{legendLabel}</span>
                  </div>
                </div>

                {/* Formatted quotation */}
                <blockquote
                  className="font-serif italic text-ink text-[13px] leading-relaxed border-l-2 pl-2.5 my-2"
                  style={{ borderColor: `rgb(var(--${n.color}))` }}
                  dangerouslySetInnerHTML={{ __html: citeInfo.html }}
                />

                {/* Student's marginal note if exists */}
                {n.note.trim() && (
                  <div className="mt-2 rounded bg-card/80 p-2 font-hand text-[15px] leading-tight text-ink border border-line/60">
                    {n.note}
                  </div>
                )}

                {/* Card actions: 1-Click Copy Citation, Delete */}
                <div className="mt-2.5 flex items-center justify-end gap-1.5 pt-1.5 border-t border-line/40">
                  <button
                    onClick={() => handleCopyQuote(n.id, n.quote, n.page)}
                    className="flex items-center gap-1 rounded bg-card px-2.5 py-1 font-sans text-[11px] text-ink border border-line shadow-2xs transition hover:border-accent hover:text-accent"
                    title="Copy quotation and formatted citation"
                  >
                    {isCopied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copied' : `Copy ${activeStyle.toUpperCase()}`}</span>
                  </button>
                  <button
                    onClick={() => removeNote(n.id)}
                    className="rounded p-1 text-soft opacity-40 hover:opacity-100 hover:text-accent transition"
                    title="Delete annotation"
                  >
                    <X size={13} />
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>

      {/* Footer count */}
      <footer className="border-t border-line bg-paper/80 px-5 py-2.5 text-center text-[11px] text-soft">
        <span className="smallcaps">
          {filtered.length} of {notes.length} marginalia · Hotkey: ⌘J / Ctrl+J
        </span>
      </footer>
    </aside>
  )
}
