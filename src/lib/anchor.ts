// Range ⇄ character-offset anchoring, painted with the native CSS Custom Highlight API
// (no DOM mutation, so React-owned page HTML stays untouched).
import type { Annotation } from './db.ts'

/** Offsets of a selection within `root`'s text, trimmed of surrounding whitespace. */
export function textOffsets(root: Node, r: Range) {
  const pre = document.createRange()
  pre.selectNodeContents(root)
  pre.setEnd(r.startContainer, r.startOffset)
  const raw = r.toString()
  const quote = raw.trim()
  if (!quote) return null
  const start = pre.toString().length + (raw.length - raw.trimStart().length)
  return { start, end: start + quote.length, quote }
}

/** Rebuild a live Range from stored offsets. Null if the text no longer reaches that far. */
export function rangeFrom(root: Node, start: number, end: number): Range | null {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const r = document.createRange()
  let pos = 0, started = false
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    const len = n.data.length
    if (!started && start <= pos + len) { r.setStart(n, start - pos); started = true }
    if (started && end <= pos + len) { r.setEnd(n, end - pos); return r }
    pos += len
  }
  return null
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
