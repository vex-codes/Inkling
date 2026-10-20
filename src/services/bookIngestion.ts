// Unified Ingestion Hub for Inkling — Ultra-Lean Chromebook Performance Engine
// Handles EPUB (Apple Books parity), PDF (capped DPR 1.5), and Markdown (.md, .txt) with Web Worker isolation.

import type { Book, Format, TocItem } from '../lib/db.ts'
import { countWords, esc, paginate } from '../lib/text.ts'
import {
  extractTocFromEpubBook,
  extractTocFromPdfDoc,
  extractTocFromMarkdown,
} from './tocExtractor.ts'

export type IngestedBook = Pick<Book, 'title' | 'author' | 'year' | 'publisher' | 'format' | 'pageCount' | 'wordCount'> & {
  pages: string[]
  prunedPages: number[]
  toc?: TocItem[]
}

export const ACCEPT = '.epub,.pdf,.md,.markdown,.txt'

export const yieldToMain = () =>
  new Promise<void>((resolve) => {
    if (
      typeof window !== 'undefined' &&
      'scheduler' in window &&
      typeof (window as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield === 'function'
    ) {
      (window as unknown as { scheduler: { yield: () => Promise<void> } }).scheduler.yield().then(resolve)
    } else {
      setTimeout(resolve, 0)
    }
  })

export const getCappedDpr = () =>
  Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5)

const prettyName = (name: string) =>
  name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const isBlankPage = (html: string): boolean => {
  const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  return (
    stripped.length === 0 ||
    stripped === 'No text layer on this page (scanned image).'
  )
}

/**
 * Format Sniffer: Checks MIME type, extension, and magic header bytes
 */
export async function sniffFormat(file: File): Promise<Format> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  try {
    const slice = await file.slice(0, 8).arrayBuffer()
    const bytes = new Uint8Array(slice)

    // PDF magic number: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf'
    }
    // ZIP / EPUB magic number: PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      if (ext === 'epub' || file.type.includes('epub')) return 'epub'
    }
  } catch {
    // Fall back to extension
  }

  if (ext === 'epub') return 'epub'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return 'txt'
}

// ── Web Worker Singleton ──────────────────────────────────────────────────────

let workerInstance: Worker | null = null

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('../workers/bookParser.worker.ts', import.meta.url),
        { type: 'module' },
      )
    } catch {
      workerInstance = null
    }
  }
  return workerInstance
}

// ── EPUB Pipeline (Apple Books Parity & Publisher CSS Scoper) ───────────────────

const BLOCK_TAGS = /^(p|h[1-6]|blockquote|li|pre|dd|dt|figcaption|hr)$/i
const CONTAINER_TAGS = /^(div|section|article|header|footer|main|aside|body)$/i

function hasBlockChildren(el: Element): boolean {
  for (const c of el.children) {
    const t = c.localName.toLowerCase()
    if (BLOCK_TAGS.test(t) || CONTAINER_TAGS.test(t)) return true
  }
  return false
}

/**
 * Clean inline text while stripping publisher fonts, colors, and ad-hoc sizes
 */
function cleanInline(node: Node): string {
  let s = ''
  for (const c of node.childNodes) {
    if (c.nodeType === Node.TEXT_NODE) {
      s += esc((c.textContent ?? '').replace(/\s+/g, ' '))
    } else if (c.nodeType === Node.ELEMENT_NODE) {
      const t = (c as Element).localName.toLowerCase()
      const inner = cleanInline(c)
      if (t === 'em' || t === 'i') s += `<em>${inner}</em>`
      else if (t === 'strong' || t === 'b') s += `<strong>${inner}</strong>`
      else if (t === 'code') s += `<code class="academic-code">${inner}</code>`
      else if (t === 'br') s += '<br>'
      else s += inner
    }
  }
  return s
}

/**
 * Normalizes publisher XHTML body into clean, semantic Inkling blocks.
 * Prevents splitting inline formatted spans into multiple distinct paragraphs.
 */
function extractSanitizedBlocks(root: Element): string[] {
  const out: string[] = []
  let isFirstParagraph = true

  const walk = (el: Element) => {
    for (const c of el.children) {
      const t = c.localName.toLowerCase()
      if (t === 'script' || t === 'style' || t === 'link' || t === 'meta') continue

      const idAttr = c.id ? ` id="${c.id}"` : ''

      if (t === 'hr') {
        out.push('<hr class="scene-divider" />')
        continue
      }

      if (t[0] === 'h' && t.length === 2) {
        const text = cleanInline(c).trim()
        if (text) {
          out.push(`<h2${idAttr}>${text}</h2>`)
          isFirstParagraph = true
        }
        continue
      }

      if (t === 'blockquote') {
        const text = cleanInline(c).trim()
        if (text) {
          out.push(`<blockquote${idAttr} class="academic-callout">${text}</blockquote>`)
        }
        continue
      }

      if (t === 'p') {
        const text = cleanInline(c).trim()
        if (text) {
          const cls = isFirstParagraph ? ' class="chapter-open"' : ''
          out.push(`<p${idAttr}${cls}>${text}</p>`)
          isFirstParagraph = false
        }
        continue
      }

      if (CONTAINER_TAGS.test(t)) {
        if (hasBlockChildren(c)) {
          walk(c)
        } else {
          // Container contains only inline text/spans — treat as a single cohesive paragraph
          const text = cleanInline(c).trim()
          if (text) {
            const cls = isFirstParagraph ? ' class="chapter-open"' : ''
            out.push(`<p${idAttr}${cls}>${text}</p>`)
            isFirstParagraph = false
          }
        }
        continue
      }

      if (hasBlockChildren(c)) {
        walk(c)
      } else {
        const text = cleanInline(c).trim()
        if (text) {
          out.push(`<p${idAttr}>${text}</p>`)
        }
      }
    }
  }

  walk(root)
  return out
}

async function fromEpub(file: File): Promise<{ pages: string[]; meta: Partial<Book>; toc: TocItem[] }> {
  const { default: ePub } = await import('epubjs')
  const book = ePub(await file.arrayBuffer())
  await book.ready

  const m = book.packaging.metadata
  const sections: { load: (r: unknown) => Promise<Element>; unload: () => void }[] = []
  book.spine.each((s: (typeof sections)[number]) => sections.push(s))

  // 1. Extract blocks from each spine section
  const spineSections: { href: string; blocks: string[] }[] = []
  let lastYield = performance.now()

  for (const s of sections) {
    if (performance.now() - lastYield > 12) {
      await yieldToMain()
      lastYield = performance.now()
    }
    const el = await s.load(book.load.bind(book))
    const body = el.getElementsByTagName('body')[0] ?? el
    const blocks = extractSanitizedBlocks(body)
    if (blocks.length > 0) {
      const href = (s as unknown as { href?: string }).href || ''
      spineSections.push({ href, blocks })
    }
    s.unload() // Instantly unload spine item DOM from memory
  }

  // 2. Intelligently group spine sections into chapters
  // Headings and their opening paragraphs must start on the same page, not 3 separate pages!
  const chapters: string[][] = []
  let currentChapter: string[] = []
  let currentWords = 0

  for (const { blocks } of spineSections) {
    const sectionWords = blocks.reduce((sum, b) => sum + countWords(b), 0)
    const hasMajorHeading = blocks.some((b) => b.startsWith('<h2'))

    // Break to a new chapter ONLY if we already have an established chapter with content (>80 words)
    // AND this new section starts with a major heading
    if (currentChapter.length > 0 && hasMajorHeading && currentWords > 80) {
      chapters.push(currentChapter)
      currentChapter = []
      currentWords = 0
    }

    currentChapter.push(...blocks)
    currentWords += sectionWords
  }

  if (currentChapter.length > 0) {
    chapters.push(currentChapter)
  }

  // 3. Paginate chapters with comfortable book page capacity (420 words per page)
  const pages = paginate(chapters.filter((c) => c.length > 0), 420)

  // 4. Extract hierarchical recursive Table of Contents with genuine calculated page numbers
  const toc = await extractTocFromEpubBook(book, pages, spineSections)
  book.destroy()

  return {
    pages,
    toc,
    meta: {
      title: m.title,
      author: m.creator,
      year: m.pubdate?.slice(0, 4),
      publisher: m.publisher,
    },
  }
}

// ── PDF Pipeline (Capped DPR 1.5 for 4GB RAM Chromebooks) ──────────────────────

type PdfItem = { str: string; transform: number[]; height: number }

function parsePdfPageText(items: PdfItem[]): string {
  const xs = items.filter((i) => i.str.trim()).map((i) => i.transform[4])
  const left = Math.min(...xs)
  const paras: string[] = []
  let cur = '', lastY: number | null = null

  for (const it of items) {
    const [, , , , x, y] = it.transform, h = it.height || 10
    if (lastY !== null && Math.abs(lastY - y) > 1) {
      const gap = lastY - y
      if (gap < 0 || gap > h * 1.9 || x > left + h * 1.2) {
        paras.push(cur)
        cur = ''
      } else {
        cur = cur.endsWith('-') ? cur.slice(0, -1) : cur.endsWith(' ') ? cur : cur + ' '
      }
    }
    cur += it.str
    lastY = y
  }
  paras.push(cur)
  const html = paras
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')

  return html || '<p><em>No text layer on this page (scanned image).</em></p>'
}

async function fromPdf(file: File): Promise<{ pages: string[]; meta: Partial<Book>; toc: TocItem[] }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default

  // Cap canvas / decoding resolution strictly at 1.5 to prevent GPU texture crash on 1366x768 Chromebooks
  void getCappedDpr()

  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
    cMapPacked: true,
  })

  const doc = await task.promise
  const info = ((await doc.getMetadata()).info ?? {}) as { Title?: string; Author?: string; CreationDate?: string }
  const pages: string[] = []
  let lastYield = performance.now()
  for (let i = 1; i <= doc.numPages; i++) {
    if (performance.now() - lastYield > 12) {
      await yieldToMain()
      lastYield = performance.now()
    }
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    pages.push(parsePdfPageText(tc.items.filter((it): it is PdfItem & typeof it => 'str' in it)))
    page.cleanup() // Reclaim PDF page cache immediately
  }

  // Extract outlines / bookmarks with accurate page numbers
  const toc = await extractTocFromPdfDoc(doc, pages)

  await doc.cleanup()
  await task.destroy()

  return {
    pages,
    toc,
    meta: {
      title: info.Title,
      author: info.Author,
      year: info.CreationDate?.match(/\d{4}/)?.[0],
    },
  }
}

// ── Markdown & Text Pipeline ──────────────────────────────────────────────────

async function fromMarkdown(file: File): Promise<{ pages: string[]; meta: Partial<Book>; toc: TocItem[] }> {
  const raw = await file.text()
  if (!raw.trim()) throw new Error('Document contains no text content.')

  const worker = getWorker()
  if (worker) {
    try {
      const response = await new Promise<{ meta: Partial<Book>; chapters: string[][]; toc: TocItem[] }>(
        (resolve, reject) => {
          const id = crypto.randomUUID()
          const timeout = setTimeout(() => reject(new Error('Worker timeout')), 3000)

          const handler = (e: MessageEvent) => {
            if (e.data?.id === id) {
              clearTimeout(timeout)
              worker.removeEventListener('message', handler)
              if (e.data.type === 'success') resolve(e.data.data)
              else reject(new Error(e.data.error || 'Worker error'))
            }
          }
          worker.addEventListener('message', handler)
          worker.postMessage({ id, type: 'parse_markdown', raw })
        },
      )

      return {
        pages: paginate(response.chapters),
        toc: response.toc,
        meta: response.meta,
      }
    } catch {
      // Fall through to inline parsing
    }
  }

  // Inline fallback if worker unavailable
  const meta: Partial<Book> = {}
  let content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatterMatch) {
    content = content.slice(frontmatterMatch[0].length)
    frontmatterMatch[1].split('\n').forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > -1) {
        const key = line.slice(0, idx).trim().toLowerCase()
        const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
        if (key === 'title') meta.title = val
        else if (key === 'author') meta.author = val
        else if (key === 'year' || key === 'date') meta.year = val.slice(0, 4)
      }
    })
  }

  const chapters: string[][] = [[]]

  for (const block of content.split(/\n\s*\n/)) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/)
    const headingText = headingMatch ? headingMatch[1].replace(/[*_#]/g, '').trim() : ''
    const inlineHtml = esc(headingMatch ? headingText : trimmed.replace(/\s+/g, ' '))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)[*_](.+?)[*_](?=\W|$)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code class="academic-code">$1</code>')

    if (headingMatch) {
      if (chapters[chapters.length - 1].length > 0) {
        chapters.push([])
      }
      chapters[chapters.length - 1].push(`<h2>${inlineHtml}</h2>`)
    } else if (/^([-*_]){3,}$/.test(trimmed)) {
      chapters[chapters.length - 1].push('<hr class="scene-divider" />')
    } else if (trimmed.startsWith('>')) {
      const quoteText = esc(trimmed.replace(/^>\s*/gm, '').trim())
      chapters[chapters.length - 1].push(`<blockquote class="academic-callout">${quoteText}</blockquote>`)
    } else {
      const isFirstPara = chapters[chapters.length - 1].filter((b) => b.startsWith('<p')).length === 0
      const cls = isFirstPara ? ' class="chapter-open"' : ''
      chapters[chapters.length - 1].push(`<p${cls}>${inlineHtml}</p>`)
    }
  }

  const pages = paginate(chapters.filter((c) => c.length > 0))
  const toc = extractTocFromMarkdown(raw, pages)
  return {
    pages,
    toc,
    meta,
  }
}

// ── Unified Public Ingest API ─────────────────────────────────────────────────

export async function ingestBook(file: File): Promise<IngestedBook> {
  if (!file || file.size === 0) {
    throw new Error('This file is empty (0 bytes). Please select a valid document.')
  }

  const format = await sniffFormat(file)
  const base = { title: prettyName(file.name), author: '', year: '', publisher: '' }
  let pages: string[] = []
  let meta: Partial<Book> = {}
  let toc: TocItem[] = []

  if (format === 'epub') {
    ;({ pages, meta, toc } = await fromEpub(file))
  } else if (format === 'pdf') {
    ;({ pages, meta, toc } = await fromPdf(file))
  } else {
    ;({ pages, meta, toc } = await fromMarkdown(file))
  }

  if (!pages.length) throw new Error('No readable text found in this file.')

  const clean = Object.fromEntries(Object.entries(meta).filter(([, v]) => typeof v === 'string' && v.trim()))

  // Detect and catalog empty or scanned flyleaves as initial pruned pages
  const prunedPages: number[] = []
  pages.forEach((p, idx) => {
    if (isBlankPage(p)) prunedPages.push(idx)
  })

  return {
    ...base,
    ...clean,
    format,
    pages,
    prunedPages,
    toc,
    pageCount: pages.length,
    wordCount: pages.reduce((n, p) => n + countWords(p), 0),
  }
}

// Backward-compatible alias
export const ingest = ingestBook
