// File → { metadata, pages[] }. Every format is normalised into clean, paginated HTML so one
// reader (and one living-margin engine) serves EPUB, PDF and Markdown alike.
import type { Book, Format } from './db.ts'
import { countWords, esc, mdToChapters, paginate } from './text.ts'

export type Ingested = Pick<Book, 'title' | 'author' | 'year' | 'publisher' | 'format' | 'pageCount' | 'wordCount'> & { pages: string[] }

export const ACCEPT = '.epub,.pdf,.md,.markdown,.txt'

const prettyName = (name: string) =>
  name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export async function ingest(file: File): Promise<Ingested> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const base = { title: prettyName(file.name), author: '', year: '', publisher: '' }
  let format: Format, pages: string[]
  let meta: Partial<typeof base> = {}

  if (!file || file.size === 0) {
    throw new Error('This file is empty (0 bytes). Please select a valid document.')
  }

  if (ext === 'epub' || ext === 'pdf') {
    try {
      ({ pages, meta } = ext === 'epub' ? await fromEpub(file) : await fromPdf(file))
      format = ext
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to parse ${ext.toUpperCase()}: ${msg}`)
    }
  } else if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
    const raw = await file.text()
    if (!raw.trim()) throw new Error('Document contains no text content.')
    pages = paginate(mdToChapters(raw))
    format = ext === 'txt' ? 'txt' : 'md'
  } else {
    throw new Error(`Inkling can’t read .${ext ?? '?'} files yet — try EPUB, PDF, or Markdown.`)
  }

  if (!pages.length) throw new Error('No readable text found in this file.')
  const clean = Object.fromEntries(Object.entries(meta).filter(([, v]) => v?.trim()))
  return { ...base, ...clean, format, pages, pageCount: pages.length, wordCount: pages.reduce((n, p) => n + countWords(p), 0) }
}

// ── EPUB ──────────────────────────────────────────────────────────────────────

const BLOCK = /^(p|h[1-6]|blockquote|li|pre|dd|dt|figcaption)$/

function inline(node: Node): string {
  let s = ''
  for (const c of node.childNodes) {
    if (c.nodeType === Node.TEXT_NODE) s += esc((c.textContent ?? '').replace(/\s+/g, ' '))
    else if (c.nodeType === Node.ELEMENT_NODE) {
      const t = (c as Element).localName, inner = inline(c)
      s += t === 'em' || t === 'i' ? `<em>${inner}</em>` : t === 'strong' || t === 'b' ? `<strong>${inner}</strong>` : t === 'br' ? '<br>' : inner
    }
  }
  return s
}

/** Whitelist sanitiser: keeps prose structure, drops scripts, styles, images, links. */
function blocks(root: Element): string[] {
  const out: string[] = []
  const walk = (el: Element) => {
    for (const c of el.children) {
      const t = c.localName
      const hasText = [...c.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
      if (t === 'script' || t === 'style') continue
      if (BLOCK.test(t) || hasText) {
        const html = inline(c).trim()
        if (html) out.push(t[0] === 'h' && t.length === 2 ? `<h2>${html}</h2>` : t === 'blockquote' ? `<blockquote>${html}</blockquote>` : `<p>${html}</p>`)
      } else walk(c)
    }
  }
  walk(root)
  return out
}

async function fromEpub(file: File) {
  const { default: ePub } = await import('epubjs')
  const book = ePub(await file.arrayBuffer())
  await book.ready
  const m = book.packaging.metadata
  const sections: { load: (r: unknown) => Promise<Element>; unload: () => void }[] = []
  book.spine.each((s: (typeof sections)[number]) => sections.push(s))
  const chapters: string[][] = []
  for (const s of sections) {
    const el = await s.load(book.load.bind(book))
    chapters.push(blocks(el.getElementsByTagName('body')[0] ?? el))
    s.unload()
  }
  book.destroy()
  return { pages: paginate(chapters.filter((c) => c.length)), meta: { title: m.title, author: m.creator, year: m.pubdate?.slice(0, 4), publisher: m.publisher } }
}

// ── PDF ───────────────────────────────────────────────────────────────────────

type PdfItem = { str: string; transform: number[]; height: number }

/**
 * ponytail: reflows the PDF text layer into paragraphs (gap/indent heuristic) so the living
 * margin works uniformly; real page numbers are kept for citations. Loses fixed layout and
 * has no OCR for scanned pages — upgrade path: PDF.js canvas + TextLayer overlay per page.
 */
function pdfPage(items: PdfItem[]): string {
  const xs = items.filter((i) => i.str.trim()).map((i) => i.transform[4])
  const left = Math.min(...xs)
  const paras: string[] = []
  let cur = '', lastY: number | null = null
  for (const it of items) {
    const [, , , , x, y] = it.transform, h = it.height || 10
    if (lastY !== null && Math.abs(lastY - y) > 1) {
      const gap = lastY - y
      if (gap < 0 || gap > h * 1.9 || x > left + h * 1.2) { paras.push(cur); cur = '' }
      else cur = cur.endsWith('-') ? cur.slice(0, -1) : cur.endsWith(' ') ? cur : cur + ' '
    }
    cur += it.str
    lastY = y
  }
  paras.push(cur)
  const html = paras.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('')
  return html || '<p><em>No text layer on this page (scanned image).</em></p>'
}

async function fromPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const info = ((await doc.getMetadata()).info ?? {}) as { Title?: string; Author?: string; CreationDate?: string }
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    pages.push(pdfPage(tc.items.filter((it): it is PdfItem & typeof it => 'str' in it)))
  }
  await doc.cleanup()
  await task.destroy()
  return { pages, meta: { title: info.Title, author: info.Author, year: info.CreationDate?.match(/\d{4}/)?.[0] } }
}
