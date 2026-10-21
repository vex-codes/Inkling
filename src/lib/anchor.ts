// Range ⇄ character-offset anchoring, painted with the native CSS Custom Highlight API
// (no DOM mutation, so React-owned page HTML stays untouched).
import type { Annotation } from './db.ts'

/**
 * Resolves any DOM boundary point (node, offset) to an exact character index within `root`'s text stream.
 * Handles both Text nodes and Element nodes (child indices).
 */
function getPointCharOffset(root: Node, targetContainer: Node, targetOffset: number): number {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let pos = 0
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    if (n === targetContainer) {
      return pos + Math.max(0, Math.min(targetOffset, n.data.length))
    }

    if (targetContainer.nodeType !== Node.TEXT_NODE) {
      if (targetContainer.contains(n)) {
        let child: Node = n
        while (child.parentNode && child.parentNode !== targetContainer) {
          child = child.parentNode
        }
        const childIndex = Array.prototype.indexOf.call(targetContainer.childNodes, child)
        if (childIndex >= targetOffset) {
          return pos
        }
      } else if (
        targetContainer.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        return pos
      }
    }

    pos += n.data.length
  }
  return pos
}

/** Offsets of a selection within `root`'s text, trimmed of surrounding whitespace. */
export function textOffsets(root: Node, r: Range) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let fullText = ''
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    fullText += n.data
  }
  if (!fullText) return null

  const rawStart = getPointCharOffset(root, r.startContainer, r.startOffset)
  const rawEnd = getPointCharOffset(root, r.endContainer, r.endOffset)

  const start = Math.min(rawStart, rawEnd)
  const end = Math.max(rawStart, rawEnd)

  if (start >= end) {
    return null
  }

  const selectedText = fullText.slice(start, end)
  if (!selectedText.trim()) {
    return null
  }

  const leadingWsMatch = selectedText.match(/^\s+/)
  const leadingWs = leadingWsMatch ? leadingWsMatch[0].length : 0

  const trailingWsMatch = selectedText.match(/\s+$/)
  const trailingWs = trailingWsMatch ? trailingWsMatch[0].length : 0

  const finalStart = start + leadingWs
  const finalEnd = end - trailingWs
  const quote = fullText.slice(finalStart, finalEnd)

  if (!quote) return null

  return {
    start: finalStart,
    end: finalEnd,
    quote,
  }
}

/** Rebuild a live Range from stored offsets. Robust to multi-span and inline elements with self-healing verification. */
export function rangeFrom(root: Node, start: number, end: number, expectedQuote?: string): Range | null {
  interface NodeSpan {
    node: Text
    start: number
    end: number
  }

  const spans: NodeSpan[] = []
  let fullText = ''
  let pos = 0
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    const len = n.data.length
    spans.push({ node: n, start: pos, end: pos + len })
    fullText += n.data
    pos += len
  }

  if (spans.length === 0) return null

  // Self-healing / Verification: If expectedQuote is provided and fullText.slice(start, end) doesn't match it,
  // locate the exact occurrence of expectedQuote closest to start.
  if (expectedQuote && expectedQuote.trim().length > 0) {
    const cleanQuote = expectedQuote.trim()
    const currentSlice = fullText.slice(start, end)
    if (currentSlice !== cleanQuote) {
      let bestIndex = -1
      let minDistance = Infinity

      let searchIndex = fullText.indexOf(cleanQuote)
      while (searchIndex !== -1) {
        const dist = Math.abs(searchIndex - start)
        if (dist < minDistance) {
          minDistance = dist
          bestIndex = searchIndex
        }
        searchIndex = fullText.indexOf(cleanQuote, searchIndex + 1)
      }

      if (bestIndex !== -1 && minDistance <= 350) {
        start = bestIndex
        end = bestIndex + cleanQuote.length
      }
    }
  }

  let startNode: Text | null = null
  let startOffset = 0

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (start >= span.start && start < span.end) {
      startNode = span.node
      startOffset = start - span.start
      break
    } else if (start === span.end) {
      if (i + 1 < spans.length && end > start) {
        startNode = spans[i + 1].node
        startOffset = 0
        break
      } else {
        startNode = span.node
        startOffset = span.node.data.length
        break
      }
    }
  }

  let endNode: Text | null = null
  let endOffset = 0

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (end > span.start && end <= span.end) {
      endNode = span.node
      endOffset = end - span.start
      break
    } else if (end === 0 && i === 0) {
      endNode = span.node
      endOffset = 0
      break
    }
  }

  if (!startNode && spans.length > 0) {
    if (start <= 0) {
      startNode = spans[0].node
      startOffset = 0
    } else {
      startNode = spans[spans.length - 1].node
      startOffset = spans[spans.length - 1].node.data.length
    }
  }

  if (!endNode && spans.length > 0) {
    if (end >= pos) {
      endNode = spans[spans.length - 1].node
      endOffset = spans[spans.length - 1].node.data.length
    } else {
      endNode = startNode
      endOffset = startOffset
    }
  }

  if (!startNode || !endNode) return null

  try {
    const r = document.createRange()
    r.setStart(startNode, startOffset)
    r.setEnd(endNode, endOffset)
    return r
  } catch {
    return null
  }
}

const supported = typeof CSS !== 'undefined' && 'highlights' in CSS
const layers = new Map<string, Highlight>()

/** Shared named highlight layer, matching a `::highlight(name)` rule in index.css. */
export function layer(name: string): Highlight | null {
  if (!supported) return null
  let h = layers.get(name)
  if (!h) {
    h = new Highlight()
    if (name === 'focus') h.priority = 1
    CSS.highlights.set(name, h)
    layers.set(name, h)
  }
  return h
}

/** Flush all active Highlight layer sets on book teardown to prevent zombie memory retention. */
export function clearAllHighlightLayers() {
  if (!supported) return
  for (const h of layers.values()) {
    h.clear()
  }
}

/** Brackets draw in the gutter instead of on the text. */
export const layerFor = (a: Annotation) =>
  a.kind === 'bracket' ? null : layer(`${a.kind === 'highlight' ? 'wash' : a.kind}-${a.color}`)

/** Locate a phrase in an HTML page — used to seed sample annotations. */
export function findInHtml(html: string, phrase: string) {
  const t = document.createElement('template')
  t.innerHTML = html
  const start = (t.content.textContent ?? '').indexOf(phrase)
  return start < 0 ? null : { start, end: start + phrase.length, quote: phrase }
}
