/// <reference lib="webworker" />
// Dedicated Web Worker for off-thread document parsing and background indexing
// Keeps Chromebook / low-spec CPU threads at a locked 60 FPS.

export interface WorkerParseRequest {
  type: 'parse_markdown' | 'sniff'
  id: string
  raw?: string
  buffer?: ArrayBuffer
  name?: string
  mime?: string
}

export interface WorkerParseResponse {
  id: string
  type: 'success' | 'error' | 'progress'
  data?: unknown
  error?: string
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c)

/**
 * Off-thread Markdown Parser with YAML frontmatter & Chapter auto-splitting
 */
function parseMarkdownOffThread(raw: string) {
  let content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const meta: { title?: string; author?: string; year?: string; publisher?: string } = {}

  // Parse YAML Frontmatter (e.g., --- \n title: 1984 \n author: George Orwell \n ---)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1]
    content = content.slice(frontmatterMatch[0].length)
    yaml.split('\n').forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > -1) {
        const key = line.slice(0, idx).trim().toLowerCase()
        const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
        if (key === 'title') meta.title = val
        else if (key === 'author') meta.author = val
        else if (key === 'year' || key === 'date') meta.year = val.slice(0, 4)
        else if (key === 'publisher') meta.publisher = val
      }
    })
  }

  // Split into chapters by '# Heading' or '# Chapter'
  const blocks = content.split(/\n\s*\n/)
  const chapters: string[][] = [[]]
  const toc: { title: string; page: number }[] = []

  let estimatedPage = 0
  let wordCountInPage = 0

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/)
    const isHeading = !!headingMatch
    const headingText = headingMatch ? headingMatch[1].replace(/[*_#]/g, '').trim() : ''

    const inlineHtml = esc(headingMatch ? headingText : trimmed.replace(/\s+/g, ' '))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)[*_](.+?)[*_](?=\W|$)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code class="academic-code">$1</code>')

    if (isHeading) {
      if (chapters[chapters.length - 1].length > 0) {
        chapters.push([])
        estimatedPage++
        wordCountInPage = 0
      }
      chapters[chapters.length - 1].push(`<h2>${inlineHtml}</h2>`)
      toc.push({ title: headingText, page: estimatedPage })
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

    const words = trimmed.split(/\s+/).length
    wordCountInPage += words
    if (wordCountInPage >= 300) {
      estimatedPage++
      wordCountInPage = 0
    }
  }

  return { meta, chapters: chapters.filter((c) => c.length > 0), toc }
}

/**
 * Format sniffer: Checks MIME type, extension, and magic file signatures
 */
function sniffFormatOffThread(buffer: ArrayBuffer, name = '', mime = ''): 'epub' | 'pdf' | 'md' | 'txt' {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const bytes = new Uint8Array(buffer.slice(0, 8))

  // PDF Magic Signature: %PDF (0x25, 0x50, 0x44, 0x46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf'
  }

  // EPUB / ZIP Magic Signature: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    if (ext === 'epub' || mime.includes('epub')) return 'epub'
  }

  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (ext === 'epub' || mime.includes('epub')) return 'epub'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return 'txt'
}

self.onmessage = (e: MessageEvent<WorkerParseRequest>) => {
  const { id, type, raw, buffer, name, mime } = e.data

  try {
    if (type === 'parse_markdown' && raw !== undefined) {
      const result = parseMarkdownOffThread(raw)
      self.postMessage({ id, type: 'success', data: result })
    } else if (type === 'sniff' && buffer) {
      const detected = sniffFormatOffThread(buffer, name, mime)
      self.postMessage({ id, type: 'success', data: detected })
    } else {
      self.postMessage({ id, type: 'error', error: 'Unknown worker command' })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    self.postMessage({ id, type: 'error', error: msg })
  }
}
