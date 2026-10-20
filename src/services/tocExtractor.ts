// Universal Table of Contents & Chapter Navigation Extractor
// Apple Books-grade hierarchical recursive extraction for EPUB, PDF, Markdown, and HTML.

import type { TocItem } from '../lib/db.ts'

export type DetailedTocItem = TocItem

interface RawTreeNode {
  id?: string
  title: string
  href?: string
  playOrder?: number
  children?: RawTreeNode[]
}

/**
 * Standard character budget for synthetic book pagination (Apple Books / ADE parity)
 * Standard paperback/screen page is ~1,080 characters or ~180 words.
 */
export const CHARS_PER_PAGE = 1080

/**
 * Helper to parse XML/XHTML text into a DOM Document safely
 */
function parseXmlDocument(xmlStr: string): Document | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlStr, 'application/xhtml+xml')
    if (doc.querySelector('parsererror')) {
      // Fallback to text/xml
      return parser.parseFromString(xmlStr, 'text/xml')
    }
    return doc
  } catch {
    try {
      const parser = new DOMParser()
      return parser.parseFromString(xmlStr, 'text/html')
    } catch {
      return null
    }
  }
}

/**
 * Parses EPUB 3 nav.xhtml / toc.xhtml document recursively
 */
function parseEpub3NavDocument(doc: Document): { tree: RawTreeNode[]; pageList: Map<string, number> } {
  const pageList = new Map<string, number>()

  // 1. Extract <pageList> if present
  try {
    const pageNavs = Array.from(doc.getElementsByTagName('nav')).filter((n) => {
      const type = n.getAttribute('epub:type') || ''
      const role = n.getAttribute('role') || ''
      const id = n.getAttribute('id') || ''
      return type.includes('page-list') || role.includes('doc-page-list') || id.includes('page-list')
    })
    for (const pageNav of pageNavs) {
      const links = Array.from(pageNav.getElementsByTagName('a'))
      for (const a of links) {
        const href = a.getAttribute('href') || ''
        const num = parseInt(a.textContent?.trim() || '', 10)
        if (href && !isNaN(num)) {
          const cleanHref = href.split('#')[0]
          const baseName = cleanHref.split('/').pop() || cleanHref
          pageList.set(href, num)
          pageList.set(cleanHref, num)
          pageList.set(baseName, num)
        }
      }
    }
  } catch {}

  // 2. Find TOC <nav>
  const navElements = Array.from(doc.getElementsByTagName('nav'))
  const tocNav =
    navElements.find((n) => {
      const epubType = n.getAttribute('epub:type') || ''
      const role = n.getAttribute('role') || ''
      const id = (n.getAttribute('id') || '').toLowerCase()
      return (
        epubType.includes('toc') ||
        role.includes('doc-toc') ||
        id === 'toc' ||
        id === 'table-of-contents' ||
        id.includes('toc')
      )
    }) || navElements[0]

  if (!tocNav) return { tree: [], pageList }

  // 3. Find root <ol> or <ul>
  const rootList =
    Array.from(tocNav.children).find(
      (c) => c.localName.toLowerCase() === 'ol' || c.localName.toLowerCase() === 'ul'
    ) ||
    tocNav.getElementsByTagName('ol')[0] ||
    tocNav.getElementsByTagName('ul')[0]

  if (!rootList) return { tree: [], pageList }

  const parseList = (listEl: Element): RawTreeNode[] => {
    const items: RawTreeNode[] = []
    const liElements = Array.from(listEl.children).filter(
      (c) => c.localName.toLowerCase() === 'li'
    )

    for (const li of liElements) {
      const directChildren = Array.from(li.children)
      const link = directChildren.find(
        (c) => c.localName.toLowerCase() === 'a' || c.localName.toLowerCase() === 'span'
      )
      const rawTitle = link?.textContent || li.firstChild?.textContent || ''
      const title = rawTitle.replace(/\s+/g, ' ').replace(/❦/g, '').trim()
      const href = (link?.getAttribute('href') || '').trim()
      const id = li.getAttribute('id') || link?.getAttribute('id') || href || title

      const subList = directChildren.find(
        (c) => c.localName.toLowerCase() === 'ol' || c.localName.toLowerCase() === 'ul'
      )
      const children = subList ? parseList(subList) : []

      if (title) {
        items.push({
          id,
          title,
          href,
          children: children.length > 0 ? children : undefined,
        })
      }
    }

    return items
  }

  return { tree: parseList(rootList), pageList }
}

/**
 * Parses EPUB 2 toc.ncx document recursively
 */
function parseEpub2NcxDocument(doc: Document): { tree: RawTreeNode[]; pageList: Map<string, number> } {
  const pageList = new Map<string, number>()

  // 1. Extract <pageList>
  try {
    const pageTargets = Array.from(doc.getElementsByTagName('pageTarget'))
    for (const pt of pageTargets) {
      const value = pt.getAttribute('value')
      const text = pt.getElementsByTagName('text')[0]?.textContent?.trim()
      const src = pt.getElementsByTagName('content')[0]?.getAttribute('src') || ''
      const num = parseInt(value || text || '', 10)
      if (src && !isNaN(num)) {
        const cleanHref = src.split('#')[0]
        const baseName = cleanHref.split('/').pop() || cleanHref
        pageList.set(src, num)
        pageList.set(cleanHref, num)
        pageList.set(baseName, num)
      }
    }
  } catch {}

  // 2. Extract <navMap>
  const navMap = doc.getElementsByTagName('navMap')[0]
  if (!navMap) return { tree: [], pageList }

  const parseNcxPoints = (parentEl: Element): RawTreeNode[] => {
    const items: RawTreeNode[] = []
    const points = Array.from(parentEl.children).filter(
      (c) => c.localName.toLowerCase() === 'navpoint'
    )

    for (const pt of points) {
      const id = pt.getAttribute('id') || ''
      const playOrder = parseInt(pt.getAttribute('playOrder') || '0', 10)
      const navLabel = Array.from(pt.children).find(
        (c) => c.localName.toLowerCase() === 'navlabel'
      )
      const textEl = navLabel
        ? Array.from(navLabel.children).find((c) => c.localName.toLowerCase() === 'text')
        : null
      const title = (textEl?.textContent || '').replace(/\s+/g, ' ').replace(/❦/g, '').trim()

      const contentEl = Array.from(pt.children).find(
        (c) => c.localName.toLowerCase() === 'content'
      )
      const href = (contentEl?.getAttribute('src') || '').trim()

      const children = parseNcxPoints(pt)

      if (title) {
        items.push({
          id: id || href || title,
          title,
          href,
          playOrder,
          children: children.length > 0 ? children : undefined,
        })
      }
    }

    return items
  }

  return { tree: parseNcxPoints(navMap), pageList }
}

/**
 * Universal Fallback: Scans rendered HTML pages for headings and builds hierarchical tree
 */
export function extractTocFromPages(pages: string[]): DetailedTocItem[] {
  const rootItems: DetailedTocItem[] = []
  const seen = new Set<string>()
  let currentParent: DetailedTocItem | null = null

  for (let i = 0; i < pages.length; i++) {
    const html = pages[i] || ''

    // 1. Scan for explicit <h1>, <h2>, <h3> headings
    const hMatches = Array.from(html.matchAll(/<h([1-3])[^>]*>(.*?)<\/h\1>/gi))
    for (const hMatch of hMatches) {
      const lvl = parseInt(hMatch[1], 10)
      const title = hMatch[2].replace(/<[^>]+>/g, '').replace(/❦/g, '').trim()
      const key = `${title.toLowerCase()}::${i}`
      if (!title || seen.has(key)) continue
      seen.add(key)

      const isFrontOrBackmatter = /^(Titlepage|Imprint|Introduction|Preface|Dedication|Epigraph|Endnotes|Colophon|Uncopyright)$/i.test(title)
      const isLetterOrChapter = /^(Letter|Chapter|Part|Book|Section)\b/i.test(title)
      const isSub = isLetterOrChapter || (Boolean(currentParent) && !isFrontOrBackmatter && lvl > 1)

      const item: DetailedTocItem = {
        id: `page-toc-${i}-${title}`,
        title,
        page: i,
        pageNumber: i + 1,
        level: isSub ? 2 : 1,
      }

      if (isSub && currentParent) {
        if (!currentParent.children) currentParent.children = []
        currentParent.children.push(item)
      } else {
        rootItems.push(item)
        if (!isFrontOrBackmatter) {
          currentParent = item
        }
      }
    }
  }

  // 2. Fallback: If document is large but has few/no headings, create balanced milestones
  if (rootItems.length <= 1 && pages.length > 4) {
    const step = pages.length > 60 ? 10 : pages.length > 25 ? 5 : 3
    for (let p = 0; p < pages.length; p += step) {
      const end = Math.min(p + step, pages.length)
      rootItems.push({
        id: `milestone-${p}`,
        title: `Pages ${p + 1}–${end}`,
        page: p,
        pageNumber: p + 1,
        level: 1,
      })
    }
  }

  return rootItems
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
    const pageIndex = pages.findIndex((p, idx) => !seenPages.has(idx) && p.toLowerCase().includes(norm))
    if (pageIndex !== -1) {
      seenPages.add(pageIndex)
      items.push({
        id: `md-${pageIndex}`,
        title: h.title,
        page: pageIndex,
        pageNumber: pageIndex + 1,
        level: h.level,
      })
    }
  }

  return items.length > 0 ? items : extractTocFromPages(pages)
}

/**
 * Extract TOC from PDF.js Document object recursively
 */
export async function extractTocFromPdfDoc(doc: any, pages: string[]): Promise<DetailedTocItem[]> {
  try {
    const outline = await doc.getOutline()
    if (outline && outline.length > 0) {
      const walkOutline = async (entries: any[], level = 1): Promise<DetailedTocItem[]> => {
        const result: DetailedTocItem[] = []
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

          const boundedPageIndex = Math.max(0, Math.min(pages.length - 1, pageIndex))
          const explicitPageNumber = boundedPageIndex + 1

          const children =
            entry.items && entry.items.length > 0
              ? await walkOutline(entry.items, level + 1)
              : undefined

          result.push({
            id: entry.dest ? String(entry.dest) : `pdf-p${explicitPageNumber}-${entry.title}`,
            title: entry.title.trim(),
            page: boundedPageIndex,
            pageNumber: explicitPageNumber,
            level,
            children: children && children.length > 0 ? children : undefined,
          })
        }
        return result
      }

      const items = await walkOutline(outline)
      if (items.length > 0) return items
    }
  } catch {
    // outline extraction is best effort
  }

  return extractTocFromPages(pages)
}

/**
 * Resolves a raw TOC tree into fully mapped TocItem tree with:
 * 1. Genuine book page numbers (matching Apple Books, e.g. Preface ~15, Frankenstein ~21, Chapter I ~52)
 * 2. 0-based page index in pages[] for instant reader navigation
 * 3. Indented recursive children
 */
function resolveEpubTree(
  nodes: RawTreeNode[],
  pages: string[],
  spinePageMap: Map<string, number>,
  spineBookPageMap: Map<string, number>,
  pageListMap: Map<string, number>,
  level = 1,
): DetailedTocItem[] {
  const result: DetailedTocItem[] = []

  for (const node of nodes) {
    const title = node.title.trim()
    if (!title) continue

    const href = (node.href || '').trim()
    const [baseHref, anchor] = href.split('#')
    const cleanBase = baseHref.replace(/^(\.\.\/)+/, '').replace(/^[a-zA-Z0-9_\-\.]+\//, '')
    const baseName = baseHref.split('/').pop() || baseHref

    // ── 1. Resolve Genuine Book Page Number (Apple Books Parity) ───────────────
    let bookPageNumber: number | undefined

    // A. Check explicit <pageList>
    if (pageListMap.has(href)) {
      bookPageNumber = pageListMap.get(href)
    } else if (pageListMap.has(baseHref)) {
      bookPageNumber = pageListMap.get(baseHref)
    } else if (pageListMap.has(baseName)) {
      bookPageNumber = pageListMap.get(baseName)
    }

    // B. Synthetic pagination based on spine progression
    if (!bookPageNumber) {
      if (spineBookPageMap.has(baseHref)) {
        bookPageNumber = spineBookPageMap.get(baseHref)
      } else if (spineBookPageMap.has(cleanBase)) {
        bookPageNumber = spineBookPageMap.get(cleanBase)
      } else if (spineBookPageMap.has(baseName)) {
        bookPageNumber = spineBookPageMap.get(baseName)
      }
    }

    // ── 2. Resolve Inkling 0-based Page Index in pages[] ───────────────────────
    let readerPageIndex = 0
    let foundInMap = false

    if (spinePageMap.has(baseHref)) {
      readerPageIndex = spinePageMap.get(baseHref)!
      foundInMap = true
    } else if (spinePageMap.has(cleanBase)) {
      readerPageIndex = spinePageMap.get(cleanBase)!
      foundInMap = true
    } else if (spinePageMap.has(baseName)) {
      readerPageIndex = spinePageMap.get(baseName)!
      foundInMap = true
    }

    // Anchor resolution: If href has an anchor, find the exact page containing this element ID or anchor text
    if (anchor) {
      const anchorRegex = new RegExp(`(?:id|name)=["']${anchor}["']`, 'i')
      const anchorPage = pages.findIndex((p) => anchorRegex.test(p))
      if (anchorPage !== -1) {
        readerPageIndex = anchorPage
      }
    }

    // Fallback search by title text if not found via spine mapping
    if (!foundInMap && pages.length > 0) {
      const lowerTitle = title.toLowerCase()
      const titlePage = pages.findIndex((p) => p.toLowerCase().includes(lowerTitle))
      if (titlePage !== -1) {
        readerPageIndex = titlePage
      }
    }

    // Bounded page index
    readerPageIndex = Math.max(0, Math.min(pages.length - 1, readerPageIndex))

    // Default book page number fallback: 1-based page index
    if (!bookPageNumber) {
      bookPageNumber = readerPageIndex + 1
    }

    // ── 3. Recurse down children ──────────────────────────────────────────────
    const children =
      node.children && node.children.length > 0
        ? resolveEpubTree(node.children, pages, spinePageMap, spineBookPageMap, pageListMap, level + 1)
        : undefined

    result.push({
      id: node.id || `toc-${level}-${result.length}-${title}`,
      title,
      href,
      page: readerPageIndex,
      pageNumber: bookPageNumber,
      level,
      children: children && children.length > 0 ? children : undefined,
    })
  }

  return result
}

/**
 * Extract TOC from ePub.js Book object and section page mapping
 */
export async function extractTocFromEpubBook(
  epubBook: any,
  pages: string[],
  spineSections: { href: string; blocks: string[] }[] = [],
): Promise<DetailedTocItem[]> {
  try {
    // 1. Build spine character counts and synthetic book page mapping
    const spineBookPageMap = new Map<string, number>()
    const spinePageMap = new Map<string, number>()

    let cumulativeBookPage = 1

    for (const section of spineSections) {
      const href = section.href || ''
      const clean = href.replace(/^(\.\.\/)+/, '')
      const base = clean.split('/').pop() || clean

      // Synthetic page calculation
      const textLength = section.blocks.reduce(
        (sum, b) => sum + b.replace(/<[^>]+>/g, '').length,
        0
      )
      const sectionBookPages = Math.max(1, Math.round(textLength / CHARS_PER_PAGE))

      spineBookPageMap.set(href, cumulativeBookPage)
      spineBookPageMap.set(clean, cumulativeBookPage)
      spineBookPageMap.set(base, cumulativeBookPage)

      // Map to first page in pages[] containing this spine section's text
      if (section.blocks.length > 0) {
        const snippet = section.blocks[0].replace(/<[^>]+>/g, '').trim().slice(0, 45)
        if (snippet) {
          const found = pages.findIndex((p) => p.includes(snippet))
          if (found !== -1) {
            spinePageMap.set(href, found)
            spinePageMap.set(clean, found)
            spinePageMap.set(base, found)
          }
        }
      }

      cumulativeBookPage += sectionBookPages
    }

    // 2. Locate navigation document in EPUB archive
    let rawTree: RawTreeNode[] = []
    let pageListMap = new Map<string, number>()

    const zip = epubBook.archive?.zip
    if (zip) {
      // Find EPUB 3 nav document (properties="nav" or nav.xhtml / toc.xhtml)
      const navPath = epubBook.packaging?.navPath
      let navFile = navPath ? zip.file(navPath) : null

      if (!navFile) {
        // Search zip keys for nav or toc xhtml
        const zipKeys = Object.keys(zip.files || {})
        const foundNavKey = zipKeys.find((k) => /(?:nav|toc)\.xhtml$/i.test(k))
        if (foundNavKey) {
          navFile = zip.file(foundNavKey)
        }
      }

      if (navFile) {
        const navXmlStr = await navFile.async('string')
        const navDoc = parseXmlDocument(navXmlStr)
        if (navDoc) {
          const parsed = parseEpub3NavDocument(navDoc)
          rawTree = parsed.tree
          pageListMap = parsed.pageList
        }
      }

      // If no EPUB 3 nav found or empty, try EPUB 2 toc.ncx
      if (rawTree.length === 0) {
        const ncxPath = epubBook.packaging?.ncxPath
        let ncxFile = ncxPath ? zip.file(ncxPath) : null

        if (!ncxFile) {
          const zipKeys = Object.keys(zip.files || {})
          const foundNcxKey = zipKeys.find((k) => /toc\.ncx$/i.test(k))
          if (foundNcxKey) {
            ncxFile = zip.file(foundNcxKey)
          }
        }

        if (ncxFile) {
          const ncxXmlStr = await ncxFile.async('string')
          const ncxDoc = parseXmlDocument(ncxXmlStr)
          if (ncxDoc) {
            const parsed = parseEpub2NcxDocument(ncxDoc)
            rawTree = parsed.tree
            if (parsed.pageList.size > 0) pageListMap = parsed.pageList
          }
        }
      }
    }

    // 3. Fallback: Check epubjs book.loaded.navigation if archive read was unavailable
    if (rawTree.length === 0) {
      try {
        const nav = await epubBook.loaded.navigation
        if (nav?.toc && nav.toc.length > 0) {
          const convertEpubJsNav = (nodes: any[]): RawTreeNode[] => {
            return nodes.map((n) => ({
              id: n.id,
              title: (n.label || n.title || '').replace(/\s+/g, ' ').trim(),
              href: n.href,
              children: n.subitems && n.subitems.length > 0 ? convertEpubJsNav(n.subitems) : undefined,
            }))
          }
          rawTree = convertEpubJsNav(nav.toc)
        }
      } catch {}
    }

    // 4. Resolve the raw tree into fully paginated and mapped TOC items
    if (rawTree.length > 0) {
      const resolved = resolveEpubTree(
        rawTree,
        pages,
        spinePageMap,
        spineBookPageMap,
        pageListMap,
        1,
      )
      if (resolved.length > 0) {
        return resolved
      }
    }
  } catch (err) {
    console.warn('Hierarchical EPUB TOC extraction error:', err)
  }

  // 5. Ultimate Fallback: Scan rendered pages
  return extractTocFromPages(pages)
}
