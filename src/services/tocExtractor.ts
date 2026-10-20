// Universal Table of Contents & Chapter Navigation Extractor
// Apple Books-grade extraction for EPUB, PDF, Markdown, and paginated HTML.

import type { TocItem } from '../lib/db.ts'

export interface DetailedTocItem extends TocItem {
  level?: number
  href?: string
}

/**
 * Universal Fallback: Scans rendered HTML pages for headings, drop caps, or chapter markers
 */
export function extractTocFromPages(pages: string[]): DetailedTocItem[] {
  const items: DetailedTocItem[] = []
  const seen = new Set<string>()

  for (let i = 0; i < pages.length; i++) {
    const html = pages[i] || ''

    // 1. Check for explicit <h2> or <h1> headings
    const hMatch = html.match(/<h[12][^>]*>(.*?)<\/h[12]>/i)
    if (hMatch) {
      const title = hMatch[1].replace(/<[^>]+>/g, '').replace(/❦/g, '').trim()
      const key = `${title.toLowerCase()}::${i}`
      if (title && !seen.has(key)) {
        seen.add(key)
        items.push({ title, page: i, level: 1 })
        continue
      }
    }

    // 2. Check for "Chapter X" or "Part X" or "Book X"
    const chapMatch = html.match(/(?:^|>)\s*(Chapter\s+(?:[0-9IVXLCDM]+|[A-Za-z]+)(?::\s*[A-Za-z0-9\s—–'-]+)?)/i)
    if (chapMatch) {
      const title = chapMatch[1].trim()
      const key = `${title.toLowerCase()}::${i}`
      if (title && !seen.has(key)) {
        seen.add(key)
        items.push({ title, page: i, level: 1 })
        continue
      }
    }
  }

  // 3. Fallback: If document is large but has few/no headings, create balanced milestones
  if (items.length <= 1 && pages.length > 4) {
    const step = pages.length > 60 ? 10 : pages.length > 25 ? 5 : 3
    for (let p = 0; p < pages.length; p += step) {
      const end = Math.min(p + step, pages.length)
      items.push({
        title: `Pages ${p + 1}–${end}`,
        page: p,
        level: 1,
      })
    }
  }

  return items
}

/**
 * Extract TOC from Markdown source text and mapped pages
 */
export function extractTocFromMarkdown(md: string, pages: string[]): DetailedTocItem[] {
  const headings: { title: string; level: number }[] = []
  const lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.*)$/)
    if (match) {
      const level = match[1].length
      const title = match[2].replace(/[*_#`]/g, '').trim()
      if (title) {
        headings.push({ title, level })
      }
    }
  }

  const items: DetailedTocItem[] = []
  const seenPages = new Set<number>()

  for (const h of headings) {
    const norm = h.title.toLowerCase()
    // Find first page containing this heading text
    const pageIndex = pages.findIndex((p, idx) => !seenPages.has(idx) && p.toLowerCase().includes(norm))
    if (pageIndex !== -1) {
      seenPages.add(pageIndex)
      items.push({ title: h.title, page: pageIndex, level: h.level })
    }
  }

  return items.length > 0 ? items : extractTocFromPages(pages)
}

/**
 * Extract TOC from PDF.js Document object
 */
export async function extractTocFromPdfDoc(doc: any, pages: string[]): Promise<DetailedTocItem[]> {
  try {
    const outline = await doc.getOutline()
    if (outline && outline.length > 0) {
      const items: DetailedTocItem[] = []

      const walkOutline = async (entries: any[], level = 1) => {
        for (const entry of entries) {
          if (!entry.title) continue
          let pageIndex = 0
          try {
            let dest = entry.dest
            if (typeof dest === 'string') {
              dest = await doc.getDestination(dest)
            }
            if (Array.isArray(dest) && dest[0]) {
              pageIndex = await doc.getPageIndex(dest[0])
            }
          } catch {
            pageIndex = 0
          }

          items.push({
            title: entry.title.trim(),
            page: Math.max(0, Math.min(pages.length - 1, pageIndex)),
            level,
          })

          if (entry.items && entry.items.length > 0) {
            await walkOutline(entry.items, level + 1)
          }
        }
      }

      await walkOutline(outline)
      if (items.length > 0) return items
    }
  } catch {
    // outline extraction is best effort
  }

  return extractTocFromPages(pages)
}

/**
 * Extract TOC from ePub.js Book object and section page mapping
 */
export async function extractTocFromEpubBook(
  epubBook: any,
  pages: string[],
  sectionPageMap?: Map<string, number>,
): Promise<DetailedTocItem[]> {
  try {
    const nav = await epubBook.loaded.navigation
    if (nav?.toc && nav.toc.length > 0) {
      const items: DetailedTocItem[] = []

      const walk = (nodes: any[], level = 1) => {
        for (const node of nodes) {
          const rawTitle = node.label || node.title || ''
          const title = rawTitle.replace(/\s+/g, ' ').trim()
          const href = (node.href || '').trim()

          if (title) {
            let page = 0
            if (sectionPageMap && href) {
              const baseHref = href.split('#')[0]
              const baseName = baseHref.split('/').pop() || baseHref
              if (sectionPageMap.has(baseHref)) {
                page = sectionPageMap.get(baseHref)!
              } else if (sectionPageMap.has(baseName)) {
                page = sectionPageMap.get(baseName)!
              }
            } else {
              // Match by heading text in pages
              const found = pages.findIndex((p) => p.toLowerCase().includes(title.toLowerCase()))
              if (found !== -1) page = found
            }

            items.push({
              title,
              page: Math.max(0, Math.min(pages.length - 1, page)),
              href,
              level,
            })
          }

          if (node.subitems && node.subitems.length > 0) {
            walk(node.subitems, level + 1)
          }
        }
      }

      walk(nav.toc)
      if (items.length > 0) return items
    }
  } catch {
    // epub nav extraction best effort
  }

  return extractTocFromPages(pages)
}
