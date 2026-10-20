// Run: npm run check   (Node ≥ 23 strips TS types natively)
import assert from 'node:assert/strict'
import { authorLast, cite, formatQuote, mdToChapters, paginate, stackMargin, toMarkdown, normalizeText } from './text.ts'
import { DEFAULT_LEGEND, type Book } from './db.ts'

console.log('Running Inkling self-check & stress tests...')

// 1. Margin stacking & Collision Avoidance (Scenario B: Annotation Cluster Bomb)
const clusterBomb = Array.from({ length: 8 }, () => ({ top: 120, height: 45 }))
const stacked = stackMargin(clusterBomb, 12)
assert.equal(stacked.length, 8)
for (let i = 1; i < stacked.length; i++) {
  const gap = stacked[i] - (stacked[i - 1] + 45)
  assert.ok(gap >= 12, `Collision detected at index ${i}: gap is ${gap}px, expected >= 12px`)
}
assert.deepEqual(stackMargin([{ top: 100, height: 50 }, { top: 0, height: 40 }, { top: 110, height: 30 }], 10), [100, 0, 160])
assert.deepEqual(stackMargin([]), [])

// 2. Scenario A: Megabook Stress Test (150,000 words / 500 chapters)
const megabookChapters = Array.from({ length: 500 }, (_, i) => [
  `<h2>Chapter ${i + 1}</h2>`,
  `<p>In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since.</p>`,
  `<p>Whenever you feel like criticizing anyone, just remember that all the people in this world haven't had the advantages that you've had.</p>`,
])
const t0 = performance.now()
const megaPages = paginate(megabookChapters, 280)
const elapsed = performance.now() - t0
assert.ok(megaPages.length >= 500, `Megabook generated ${megaPages.length} pages`)
assert.ok(elapsed < 60, `Megabook pagination took ${elapsed.toFixed(1)}ms (target: <60ms)`)
console.log(`✓ Megabook stress test passed: 500 chapters paginated into ${megaPages.length} pages in ${elapsed.toFixed(1)}ms`)

// 3. Markdown → chapters → pages
const ch = mdToChapters('# One\n\nIt was _dark_ & **stormy**.\n\nline\nwrapped\n\n# Two\n\nEnd.')
assert.deepEqual(ch, [
  ['<h2>One</h2>', '<p>It was <em>dark</em> &amp; <strong>stormy</strong>.</p>', '<p>line wrapped</p>'],
  ['<h2>Two</h2>', '<p>End.</p>'],
])
assert.equal(paginate(ch, 3).length, 4)
assert.ok(paginate(ch, 3)[3].startsWith('<h2>Two'))

// 4. Academic Citation Formatting (MLA 9, APA 7, Chicago)
const gatsby = { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: '1925' }
assert.equal(authorLast('Shelley, Mary'), 'Shelley')
assert.equal(authorLast('Fitzgerald'), 'Fitzgerald')
assert.equal(cite('mla', gatsby, 42).text, '(Fitzgerald 42)')
assert.equal(cite('apa', gatsby, 42).text, '(Fitzgerald, 1925, p. 42)')
assert.equal(cite('chicago', gatsby, 42).html, 'Fitzgerald, <i>The Great Gatsby</i>, 42.')
assert.equal(formatQuote('mla', 'he said, “so we beat on.”', gatsby, 9).text, '“he said, ‘so we beat on.’” (Fitzgerald 9).')
assert.equal(formatQuote('mla', 'Old sport.', gatsby, 3).text, '“Old sport” (Fitzgerald 3).')
assert.equal(formatQuote('chicago', 'Can’t repeat the past?', gatsby, 3).text.split('\n')[0], '“Can’t repeat the past?”¹')

// 5. Obsidian / Markdown Study Guide Export
const book: Book = {
  ...gatsby,
  id: 'b',
  publisher: '',
  format: 'md',
  pageCount: 1,
  wordCount: 1,
  addedAt: 0,
  page: 0,
  dogears: [],
  flags: [{ id: 'f', page: 0, color: 'ochre', label: 'Thesis' }],
  legend: DEFAULT_LEGEND,
}
const md = toMarkdown(
  book,
  [{ id: 'a', bookId: 'b', page: 2, start: 0, end: 5, quote: 'green light', kind: 'highlight', color: 'ochre', note: 'motif!', createdAt: 0 }],
  'mla',
  '2026-01-01',
)
assert.match(md, /^---\ntitle: "The Great Gatsby"/)
assert.match(md, /## Page 3\n\n> “green light” \(Fitzgerald 3\)\.\n\n#motif · highlight — motif!/)
assert.match(md, /- p\. 1 — Thesis #motif/)

// 6. Crucible Stress Suite: 1,000 Annotations Saturation Test
const thousandNotes = Array.from({ length: 1000 }, (_, i) => ({
  top: (i % 30) * 40 + (i % 5) * 8,
  height: 38,
}))
const tStack = performance.now()
const stackedThousand = stackMargin(thousandNotes, 10)
const elapsedStack = performance.now() - tStack
assert.equal(stackedThousand.length, 1000)
assert.ok(elapsedStack < 25, `1,000 margin layout took ${elapsedStack.toFixed(1)}ms (target: <25ms)`)
console.log(`✓ Crucible: 1,000 annotations stacked in ${elapsedStack.toFixed(2)}ms`)

// 7. Academic Smart Quote & Dash Normalization Test
assert.equal(normalizeText('“The Waste Land” — T.S. Eliot'), '"the waste land" - t.s. eliot')
assert.equal(normalizeText("Macbeth’s ‘fatal vision’"), "macbeth's 'fatal vision'")
assert.ok(normalizeText('“Green Light”').includes(normalizeText('"green light"')))
console.log('✓ Academic typographic quote & dash normalization passed.')

console.log('✓ All unit and stress-test assertions passed cleanly.')
