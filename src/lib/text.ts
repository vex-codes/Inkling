// Pure text helpers — no DOM, no Dexie. Exercised by selfcheck.ts under plain Node.
import type { Annotation, Book, Ink, Style } from './db.ts'

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export const countWords = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length

/**
 * Academic text normalizer: converts smart quotes, apostrophes, dashes, and NFKD accents
 * to standard ASCII equivalents so searches match typography accurately.
 */
export function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .normalize('NFKD')
}

/**
 * Markdown/plain text → chapters of HTML blocks. `#` headings open a new chapter.
 * ponytail: paragraphs, headings, *em*, _em_, **strong** only — enough for literature
 * archives (Gutenberg uses _italics_). Swap in `marked` if lists/links/code matter.
 */
export function mdToChapters(md: string): string[][] {
  const chapters: string[][] = [[]]
  for (const raw of md.replace(/\r/g, '').split(/\n\s*\n/)) {
    const p = raw.replace(/\s*\n\s*/g, ' ').trim()
    if (!p) continue
    const h = p.match(/^#{1,6}\s+(.*)$/)
    const inline = esc(h ? h[1] : p)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)[*_](.+?)[*_](?=\W|$)/g, '$1<em>$2</em>')
    if (h) {
      if (chapters.at(-1)!.length) chapters.push([])
      chapters.at(-1)!.push(`<h2>${inline}</h2>`)
    } else chapters.at(-1)!.push(`<p>${inline}</p>`)
  }
  return chapters.filter((c) => c.length)
}

/** Flow block HTML into book-like pages. Chapters always start on a fresh page. */
export function paginate(chapters: string[][], wordsPerPage = 300): string[] {
  const pages: string[] = []
  for (const blocks of chapters) {
    let page = '', words = 0
    for (const b of blocks) {
      const w = countWords(b)
      if (words && words + w > wordsPerPage) { pages.push(page); page = ''; words = 0 }
      page += b
      words += w
    }
    if (page) pages.push(page)
  }
  return pages
}

/**
 * Living-margin collision pass: each card wants to sit at its anchor's `top`;
 * cards are pushed down so none overlap. Returns tops in input order.
 */
export function stackMargin(items: { top: number; height: number }[], gap = 10): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].top - items[b].top)
  const tops = new Array<number>(items.length)
  let floor = -Infinity
  for (const i of order) {
    tops[i] = Math.max(items[i].top, floor)
    floor = tops[i] + items[i].height + gap
  }
  return tops
}

/** "F. Scott Fitzgerald" → "Fitzgerald"; "Shelley, Mary" → "Shelley". */
export function authorLast(author: string): string {
  const a = author.trim()
  if (!a) return 'Anonymous'
  if (a.includes(',')) return a.split(',')[0].trim()
  // ponytail: last token wins — misses particles/suffixes ("de Beauvoir", "Jr."). Edit the author field as "Last, First" to override.
  return a.split(/\s+/).at(-1)!
}

type CiteBook = Pick<Book, 'title' | 'author' | 'year'>

/** Bare parenthetical/note citation. `page` is 1-based. */
export function cite(style: Style, b: CiteBook, page: number) {
  const last = authorLast(b.author)
  if (style === 'mla') return { text: `(${last} ${page})`, html: `(${esc(last)} ${page})` }
  if (style === 'apa') { const t = `(${last}, ${b.year || 'n.d.'}, p. ${page})`; return { text: t, html: esc(t) } }
  return { text: `${last}, ${b.title}, ${page}.`, html: `${esc(last)}, <i>${esc(b.title)}</i>, ${page}.` }
}

/** Quote + citation, ready to paste into an essay. Inner double quotes become single (MLA/APA/CMOS rule). */
export function formatQuote(style: Style, quote: string, b: CiteBook, page: number) {
  const t = quote.trim()
  const q = (/^[“"][^“”"]*[”"]$/.test(t) ? t.slice(1, -1) : t).replace(/“/g, '‘').replace(/”/g, '’').replace(/[.,;:]+$/, '')
  const c = cite(style, b, page)
  const dot = /[?!]$/.test(q) ? '' : '.'
  if (style === 'chicago') return { text: `“${q}${dot}”¹\n\n¹ ${c.text}`, html: `“${esc(q)}${dot}”<sup>1</sup><br><br><sup>1</sup> ${c.html}` }
  return { text: `“${q}” ${c.text}.`, html: `“${esc(q)}” ${c.html}.` }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Obsidian-friendly study guide: YAML front matter, grouped by page, legend labels as #tags. */
export function toMarkdown(b: Book, notes: Annotation[], style: Style, today = new Date().toISOString().slice(0, 10)): string {
  const tag = (c: Ink) => `#${slug(b.legend[c]) || c}`
  const out = [
    '---',
    `title: "${b.title.replace(/"/g, '\\"')}"`,
    `author: "${b.author.replace(/"/g, '\\"')}"`,
    `year: ${b.year || 'n.d.'}`,
    'tags: [inkling, quotebook]',
    `exported: ${today}`,
    '---',
    '',
    `# ${b.title} — Quotebook`,
    '',
  ]
  if (b.flags.length) {
    out.push('## Page flags', '')
    for (const f of [...b.flags].sort((x, y) => x.page - y.page)) out.push(`- p. ${f.page + 1} — ${f.label} ${tag(f.color)}`)
    out.push('')
  }
  let page = -1
  for (const n of [...notes].sort((x, y) => x.page - y.page || x.start - y.start)) {
    if (n.page !== page) { page = n.page; out.push(`## Page ${page + 1}`, '') }
    out.push(`> ${formatQuote(style, n.quote, b, n.page + 1).text.replace(/\n/g, '\n> ')}`, '')
    out.push(`${tag(n.color)} · ${n.kind}${n.note.trim() ? ` — ${n.note.trim()}` : ''}`, '')
  }
  return out.join('\n')
}
