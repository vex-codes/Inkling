// Run: npm run check   (Node ≥ 23 strips TS types natively)
import assert from 'node:assert/strict'
import { authorLast, cite, formatQuote, mdToChapters, paginate, stackMargin, toMarkdown } from './text.ts'
import { DEFAULT_LEGEND, type Book } from './db.ts'

// Margin stacking: overlapping cards pushed down, order preserved, non-overlapping untouched.
assert.deepEqual(stackMargin([{ top: 100, height: 50 }, { top: 0, height: 40 }, { top: 110, height: 30 }], 10), [100, 0, 160])
assert.deepEqual(stackMargin([]), [])

// Markdown → chapters → pages.
const ch = mdToChapters('# One\n\nIt was _dark_ & **stormy**.\n\nline\nwrapped\n\n# Two\n\nEnd.')
assert.deepEqual(ch, [
  ['<h2>One</h2>', '<p>It was <em>dark</em> &amp; <strong>stormy</strong>.</p>', '<p>line wrapped</p>'],
  ['<h2>Two</h2>', '<p>End.</p>'],
])
assert.equal(paginate(ch, 3).length, 4) // "One" + 5-word para overflow, then "line wrapped", chapter two fresh page
assert.ok(paginate(ch, 3)[3].startsWith('<h2>Two'))

// Citations.
const gatsby = { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: '1925' }
assert.equal(authorLast('Shelley, Mary'), 'Shelley')
assert.equal(cite('mla', gatsby, 42).text, '(Fitzgerald 42)')
assert.equal(cite('apa', gatsby, 42).text, '(Fitzgerald, 1925, p. 42)')
assert.equal(cite('chicago', gatsby, 42).html, 'Fitzgerald, <i>The Great Gatsby</i>, 42.')
assert.equal(formatQuote('mla', 'he said, “so we beat on.”', gatsby, 9).text, '“he said, ‘so we beat on.’” (Fitzgerald 9).')
assert.equal(formatQuote('mla', 'Old sport.', gatsby, 3).text, '“Old sport” (Fitzgerald 3).')
assert.equal(formatQuote('chicago', 'Can’t repeat the past?', gatsby, 3).text.split('\n')[0], '“Can’t repeat the past?”¹')

// Export.
const book: Book = { ...gatsby, id: 'b', publisher: '', format: 'md', pageCount: 1, wordCount: 1, addedAt: 0, page: 0, dogears: [], flags: [{ id: 'f', page: 0, color: 'ochre', label: 'Thesis' }], legend: DEFAULT_LEGEND }
const md = toMarkdown(book, [{ id: 'a', bookId: 'b', page: 2, start: 0, end: 5, quote: 'green light', kind: 'highlight', color: 'ochre', note: 'motif!', createdAt: 0 }], 'mla', '2026-01-01')
assert.match(md, /^---\ntitle: "The Great Gatsby"/)
assert.match(md, /## Page 3\n\n> “green light” \(Fitzgerald 3\)\.\n\n#motif · highlight — motif!/)
assert.match(md, /- p\. 1 — Thesis #motif/)

console.log('selfcheck ok')
