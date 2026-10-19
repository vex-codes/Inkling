import { create } from 'zustand'
import { db, DEFAULT_LEGEND, DEFAULT_PREFS, type Annotation, type Book, type Flag, type Ink, type Kind, type Prefs } from './lib/db.ts'
import { findInHtml } from './lib/anchor.ts'
import { ingest } from './lib/ingest.ts'
import { countWords, mdToChapters, paginate } from './lib/text.ts'
import gatsby from './sample/gatsby-ch1.md?raw'

type NewMark = Pick<Annotation, 'page' | 'start' | 'end' | 'quote' | 'kind' | 'color'>

interface State {
  ready: boolean
  prefs: Prefs
  books: Book[]
  book: Book | null
  pages: string[]
  notes: Annotation[]
  drawer: boolean
  focusId: string | null // card whose textarea should grab focus once mounted
  init(): Promise<void>
  setPrefs(p: Partial<Prefs>): void
  addBook(file: File): Promise<void>
  removeBook(id: string): Promise<void>
  openBook(id: string): Promise<void>
  closeBook(): void
  updateBook(patch: Partial<Book>): void
  toggleDogear(page: number): void
  saveFlag(f: Omit<Flag, 'id'> & { id?: string }): void
  removeFlag(id: string): void
  annotate(m: NewMark): string
  updateNote(id: string, patch: Partial<Pick<Annotation, 'note' | 'color' | 'kind'>>): void
  removeNote(id: string): void
  toggleDrawer(open?: boolean): void
}

const uid = () => crypto.randomUUID()
// Writes are fire-and-forget after the optimistic state update; surface failures loudly.
const persist = (p: Promise<unknown>) => p.catch((e) => console.error('[inkling] IndexedDB write failed', e))

/** First launch: shelve Gatsby ch. 1 with a few worked annotations so the margin is alive immediately. */
async function seedSample(): Promise<Book> {
  const pages = paginate(mdToChapters(gatsby))
  const book: Book = {
    id: uid(), title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: '1925', publisher: 'Charles Scribner’s Sons',
    format: 'md', pageCount: pages.length, wordCount: pages.reduce((n, p) => n + countWords(p), 0), addedAt: Date.now(),
    page: 0, dogears: [], flags: [{ id: uid(), page: 0, color: 'rose', label: 'Narrator' }], legend: { ...DEFAULT_LEGEND },
  }
  const seeds: [string, Kind, Ink, string][] = [
    ['reserve all judgements', 'highlight', 'rose', 'Claims to withhold judgement — then judges everyone. Reliable narrator?'],
    ['Gatsby, who represented everything for which I have an unaffected scorn', 'squiggle', 'indigo', 'Scorn and admiration in one breath.'],
    ['beautiful little fool', 'note', 'lilac', 'Daisy’s wish for her daughter: irony, or despair about what women are allowed to be?'],
    ['a single green light, minute and far away', 'highlight', 'ochre', 'First sighting of the green light. Track it!'],
  ]
  const notes: Annotation[] = []
  for (const [phrase, kind, color, note] of seeds) {
    const page = pages.findIndex((p) => findInHtml(p, phrase))
    const at = page >= 0 && findInHtml(pages[page], phrase)
    if (at) notes.push({ id: uid(), bookId: book.id, page, ...at, kind, color, note, createdAt: Date.now() + notes.length })
  }
  await db.transaction('rw', db.books, db.contents, db.annotations, async () => {
    await db.books.put(book)
    await db.contents.put({ id: book.id, pages })
    await db.annotations.bulkPut(notes)
  })
  return book
}

export const useStore = create<State>()((set, get) => {
  const patchBook = (patch: Partial<Book>) => {
    const b = get().book
    if (!b) return
    const book = { ...b, ...patch }
    set({ book, books: get().books.map((x) => (x.id === b.id ? book : x)) })
    persist(db.books.update(b.id, patch))
  }

  return {
    ready: false, prefs: DEFAULT_PREFS, books: [], book: null, pages: [], notes: [], drawer: false, focusId: null,

    async init() {
      const prefs = { ...DEFAULT_PREFS, ...(await db.prefs.get('reader')) }
      let books = await db.books.orderBy('addedAt').toArray()
      if (!books.length) {
        const sample = await seedSample()
        books = [sample]
        prefs.lastBook = sample.id
      }
      set({ prefs, books })
      if (prefs.lastBook && books.some((b) => b.id === prefs.lastBook)) await get().openBook(prefs.lastBook)
      set({ ready: true })
    },

    setPrefs(p) {
      const prefs = { ...get().prefs, ...p }
      set({ prefs })
      persist(db.prefs.put(prefs, 'reader'))
    },

    async addBook(file) {
      const { pages, ...meta } = await ingest(file)
      const book: Book = { ...meta, id: uid(), addedAt: Date.now(), page: 0, dogears: [], flags: [], legend: { ...DEFAULT_LEGEND } }
      await db.transaction('rw', db.books, db.contents, async () => {
        await db.books.put(book)
        await db.contents.put({ id: book.id, pages })
      })
      set({ books: [...get().books, book] })
    },

    async removeBook(id) {
      await db.transaction('rw', db.books, db.contents, db.annotations, async () => {
        await db.books.delete(id)
        await db.contents.delete(id)
        await db.annotations.where('bookId').equals(id).delete()
      })
      set({ books: get().books.filter((b) => b.id !== id) })
    },

    async openBook(id) {
      const [book, content, notes] = await Promise.all([db.books.get(id), db.contents.get(id), db.annotations.where('bookId').equals(id).toArray()])
      if (!book || !content) return
      set({ book: { ...book, legend: { ...DEFAULT_LEGEND, ...book.legend } }, pages: content.pages, notes })
      get().setPrefs({ lastBook: id })
    },

    closeBook() {
      set({ book: null, pages: [], notes: [], drawer: false })
      get().setPrefs({ lastBook: null })
    },

    updateBook: patchBook,

    toggleDogear(page) {
      const d = get().book?.dogears ?? []
      patchBook({ dogears: d.includes(page) ? d.filter((p) => p !== page) : [...d, page] })
    },

    saveFlag({ id, ...f }) {
      const flags = get().book?.flags ?? []
      patchBook({ flags: id ? flags.map((x) => (x.id === id ? { id, ...f } : x)) : [...flags, { id: uid(), ...f }] })
    },

    removeFlag(id) {
      patchBook({ flags: (get().book?.flags ?? []).filter((f) => f.id !== id) })
    },

    annotate(m) {
      const book = get().book
      if (!book) return ''
      const a: Annotation = { ...m, id: uid(), bookId: book.id, note: '', createdAt: Date.now() }
      set({ notes: [...get().notes, a], focusId: m.kind === 'note' ? a.id : null })
      persist(db.annotations.put(a))
      return a.id
    },

    updateNote(id, patch) {
      set({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })
      persist(db.annotations.update(id, patch))
    },

    removeNote(id) {
      set({ notes: get().notes.filter((n) => n.id !== id) })
      persist(db.annotations.delete(id))
    },

    toggleDrawer(open) {
      set({ drawer: open ?? !get().drawer })
    },
  }
})
