import { create } from 'zustand'
import { db, DEFAULT_LEGEND, DEFAULT_PREFS, type Annotation, type Book, type Flag, type Ink, type Kind, type Prefs } from './lib/db.ts'
import { findInHtml, clearAllHighlightLayers } from './lib/anchor.ts'
import { ingest } from './lib/ingest.ts'
import { countWords, mdToChapters, paginate } from './lib/text.ts'
import { extractTocFromMarkdown, extractTocFromPages } from './services/tocExtractor.ts'
import gatsby from './sample/gatsby-ch1.md?raw'

type NewMark = Pick<Annotation, 'page' | 'start' | 'end' | 'quote' | 'kind' | 'color'>

export interface DeletedStash {
  book: Book
  pages: string[]
  notes: Annotation[]
  timeoutId: number
  expiresAt: number
}

interface State {
  ready: boolean
  isSaving: boolean
  prefs: Prefs
  books: Book[]
  book: Book | null
  pages: string[]
  notes: Annotation[]
  drawer: boolean
  chapterDrawer: boolean
  focusId: string | null
  focusMode: boolean
  isFastScrolling: boolean
  comparativeMode: boolean
  comparativeBookId: string | null
  comparativePages: string[]
  comparativeNotes: string
  syncScroll: boolean
  deletedStash: DeletedStash | null
  storageWarning: string | null
  prunedSnackbar: { page: number; timerId: number } | null
  managePrunedOpen: boolean
  init(): Promise<void>
  setPrefs(p: Partial<Prefs>): void
  setFastScrolling(active: boolean): void
  toggleFocusMode(on?: boolean): void
  toggleComparativeMode(on?: boolean): void
  setComparativeBook(id: string | null): Promise<void>
  setComparativeNotes(notes: string): void
  toggleSyncScroll(on?: boolean): void
  prunePage(pageIndex: number): Promise<void>
  restorePage(pageIndex: number): Promise<void>
  restoreAllPages(): Promise<void>
  undoPrune(): Promise<void>
  dismissPrunedSnackbar(): void
  toggleManagePruned(open?: boolean): void
  addBook(file: File): Promise<void>
  stageRemoveBook(id: string): Promise<void>
  undoRemoveBook(): Promise<void>
  commitRemoveBook(): Promise<void>
  renameBook(id: string, title: string, author: string, year?: string): Promise<void>
  reseedSample(): Promise<void>
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
  toggleChapterDrawer(open?: boolean): void
  backupSanctuary(): Promise<string>
  restoreSanctuary(jsonString: string): Promise<void>
}

const uid = () => crypto.randomUUID()
const SEEDED_KEY = 'inkling_sample_seeded'

export const useStore = create<State>()((set, get) => {
  let saveTimer = 0

  const signalSave = () => {
    set({ isSaving: true })
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => set({ isSaving: false }), 450)
  }

  const persist = (p: Promise<unknown>) => {
    signalSave()
    return p.catch((e: unknown) => {
      console.error('[inkling] IndexedDB write failed', e)
      const err = e as { name?: string; message?: string }
      if (err?.name === 'QuotaExceededError' || err?.message?.includes?.('quota')) {
        set({ storageWarning: 'Storage quota exceeded. Please export a sanctuary backup to preserve your notes.' })
      }
    })
  }

  const patchBook = (patch: Partial<Book>) => {
    const b = get().book
    if (!b) return
    const book = { ...b, ...patch }
    set({ book, books: get().books.map((x) => (x.id === b.id ? book : x)) })
    persist(db.books.update(b.id, patch))
  }

  const seedSample = async (): Promise<Book> => {
    const chapters = mdToChapters(gatsby)
    const pages = paginate(chapters)
    const toc = extractTocFromMarkdown(gatsby, pages)
    const book: Book = {
      id: uid(),
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      year: '1925',
      publisher: 'Charles Scribner’s Sons',
      format: 'md',
      pageCount: pages.length,
      wordCount: pages.reduce((n, p) => n + countWords(p), 0),
      addedAt: Date.now(),
      page: 0,
      dogears: [],
      flags: [{ id: uid(), page: 0, color: 'rose', label: 'Narrator' }],
      legend: { ...DEFAULT_LEGEND },
      prunedPages: [],
      toc,
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
    try {
      localStorage.setItem(SEEDED_KEY, 'true')
    } catch {
      // ignore
    }
    return book
  }

  const checkStorageQuota = async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate()
        if (est.quota && est.usage) {
          const pct = Math.round((est.usage / est.quota) * 100)
          if (pct > 80) {
            set({ storageWarning: `Browser storage is ${pct}% full. Consider exporting a sanctuary backup.` })
          }
        }
      }
    } catch {
      // quota check is best-effort
    }
  }

  return {
    ready: false,
    isSaving: false,
    prefs: DEFAULT_PREFS,
    books: [],
    book: null,
    pages: [],
    notes: [],
    drawer: false,
    chapterDrawer: false,
    focusId: null,
    focusMode: false,
    isFastScrolling: false,
    comparativeMode: false,
    comparativeBookId: null,
    comparativePages: [],
    comparativeNotes: '',
    syncScroll: true,
    deletedStash: null,
    storageWarning: null,
    prunedSnackbar: null,
    managePrunedOpen: false,

    async init() {
      const prefs = { ...DEFAULT_PREFS, ...(await db.prefs.get('reader')) }
      let books = await db.books.orderBy('addedAt').toArray()
      const alreadySeeded = localStorage.getItem(SEEDED_KEY)

      if (!books.length && !alreadySeeded) {
        const sample = await seedSample()
        books = [sample]
        prefs.lastBook = sample.id
      }

      set({ prefs, books })
      if (prefs.lastBook && books.some((b) => b.id === prefs.lastBook)) {
        await get().openBook(prefs.lastBook)
      }
      set({ ready: true })
      void checkStorageQuota()
    },

    setPrefs(p) {
      const prefs = { ...get().prefs, ...p }
      set({ prefs })
      persist(db.prefs.put(prefs, 'reader'))
    },

    async prunePage(pageIndex: number) {
      const b = get().book
      if (!b) return
      const currentPruned = b.prunedPages ?? []
      if (currentPruned.includes(pageIndex)) return
      const nextPruned = [...currentPruned, pageIndex].sort((a, b) => a - b)
      patchBook({ prunedPages: nextPruned })

      if (get().prunedSnackbar?.timerId) {
        window.clearTimeout(get().prunedSnackbar!.timerId)
      }
      const timerId = window.setTimeout(() => {
        set({ prunedSnackbar: null })
      }, 6000)

      set({
        prunedSnackbar: { page: pageIndex, timerId },
      })
    },

    async restorePage(pageIndex: number) {
      const b = get().book
      if (!b) return
      const currentPruned = b.prunedPages ?? []
      const nextPruned = currentPruned.filter((p) => p !== pageIndex)
      patchBook({ prunedPages: nextPruned })
      if (get().prunedSnackbar?.page === pageIndex) {
        window.clearTimeout(get().prunedSnackbar!.timerId)
        set({ prunedSnackbar: null })
      }
    },

    async restoreAllPages() {
      const b = get().book
      if (!b) return
      patchBook({ prunedPages: [] })
      if (get().prunedSnackbar) {
        window.clearTimeout(get().prunedSnackbar!.timerId)
        set({ prunedSnackbar: null })
      }
    },

    async undoPrune() {
      const snack = get().prunedSnackbar
      if (!snack) return
      await get().restorePage(snack.page)
    },

    dismissPrunedSnackbar() {
      if (get().prunedSnackbar?.timerId) {
        window.clearTimeout(get().prunedSnackbar!.timerId)
      }
      set({ prunedSnackbar: null })
    },

    toggleManagePruned(open?: boolean) {
      set({ managePrunedOpen: open ?? !get().managePrunedOpen })
    },

    async addBook(file) {
      signalSave()
      const { pages, prunedPages, toc, ...meta } = await ingest(file)
      const book: Book = {
        ...meta,
        id: uid(),
        addedAt: Date.now(),
        page: 0,
        dogears: [],
        flags: [],
        legend: { ...DEFAULT_LEGEND },
        prunedPages: prunedPages ?? [],
        toc: toc ?? [],
      }
      await db.transaction('rw', db.books, db.contents, async () => {
        await db.books.put(book)
        await db.contents.put({ id: book.id, pages })
      })
      set({ books: [...get().books, book] })
      void checkStorageQuota()
    },

    async stageRemoveBook(id) {
      // Commit any previously pending deletion first
      if (get().deletedStash) {
        await get().commitRemoveBook()
      }

      const book = get().books.find((b) => b.id === id) || (await db.books.get(id))
      if (!book) return

      const [content, notes] = await Promise.all([
        db.contents.get(id),
        db.annotations.where('bookId').equals(id).toArray(),
      ])

      // Close book if currently open
      if (get().book?.id === id) {
        get().closeBook()
      }

      // Optimistically remove from shelf
      set({ books: get().books.filter((b) => b.id !== id) })

      const timeoutId = window.setTimeout(() => {
        void get().commitRemoveBook()
      }, 5000)

      set({
        deletedStash: {
          book,
          pages: content?.pages ?? [],
          notes,
          timeoutId,
          expiresAt: Date.now() + 5000,
        },
      })
    },

    async undoRemoveBook() {
      const stash = get().deletedStash
      if (!stash) return

      window.clearTimeout(stash.timeoutId)
      const book = stash.book

      // Check if it already exists or re-insert
      const existing = await db.books.get(book.id)
      if (!existing) {
        await db.transaction('rw', db.books, db.contents, db.annotations, async () => {
          await db.books.put(book)
          await db.contents.put({ id: book.id, pages: stash.pages })
          if (stash.notes.length) {
            await db.annotations.bulkPut(stash.notes)
          }
        })
      }

      set({
        books: [...get().books, book].sort((a, b) => a.addedAt - b.addedAt),
        deletedStash: null,
      })
    },

    async commitRemoveBook() {
      const stash = get().deletedStash
      if (!stash) return
      window.clearTimeout(stash.timeoutId)
      const targetId = stash.book.id

      await db.transaction('rw', db.books, db.contents, db.annotations, async () => {
        await db.books.delete(targetId)
        await db.contents.delete(targetId)
        await db.annotations.where('bookId').equals(targetId).delete()
      })

      set({ deletedStash: null })
      if (get().prefs.lastBook === targetId) {
        get().setPrefs({ lastBook: null })
      }
    },

    async renameBook(id, title, author, year) {
      const patch: Partial<Book> = { title: title.trim() }
      if (author !== undefined) patch.author = author.trim()
      if (year !== undefined) patch.year = year.trim()

      set({
        books: get().books.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        book: get().book?.id === id ? { ...get().book!, ...patch } : get().book,
      })
      persist(db.books.update(id, patch as any))
    },

    async reseedSample() {
      const sample = await seedSample()
      set({ books: [...get().books, sample] })
      await get().openBook(sample.id)
    },

    async openBook(id) {
      clearAllHighlightLayers()
      const [book, content, notes] = await Promise.all([
        db.books.get(id),
        db.contents.get(id),
        db.annotations.where('bookId').equals(id).toArray(),
      ])
      if (!book || !content) return

      let toc = book.toc
      if (!toc || toc.length === 0) {
        toc = extractTocFromPages(content.pages)
        if (toc.length > 0) {
          void db.books.update(id, { toc })
        }
      }

      set({
        book: {
          ...book,
          toc,
          legend: { ...DEFAULT_LEGEND, ...book.legend },
          prunedPages: book.prunedPages ?? [],
        },
        pages: content.pages,
        notes,
        focusId: null,
      })
      get().setPrefs({ lastBook: id })
    },

    closeBook() {
      clearAllHighlightLayers()
      set({
        book: null,
        pages: [],
        notes: [],
        drawer: false,
        chapterDrawer: false,
        comparativeMode: false,
        comparativeBookId: null,
        comparativePages: [],
      })
      get().setPrefs({ lastBook: null })
    },

    toggleComparativeMode(on) {
      const next = on ?? !get().comparativeMode
      set({ comparativeMode: next })
      if (next && !get().comparativeBookId) {
        const other = get().books.find((b) => b.id !== get().book?.id)
        if (other) {
          void get().setComparativeBook(other.id)
        }
      }
    },

    async setComparativeBook(id) {
      if (!id) {
        set({ comparativeBookId: null, comparativePages: [] })
        return
      }
      const content = await db.contents.get(id)
      set({
        comparativeBookId: id,
        comparativePages: content?.pages ?? [],
      })
    },

    setComparativeNotes(notes) {
      set({ comparativeNotes: notes })
    },

    toggleSyncScroll(on) {
      set({ syncScroll: on ?? !get().syncScroll })
    },

    updateBook: patchBook,

    toggleDogear(page) {
      const d = get().book?.dogears ?? []
      patchBook({ dogears: d.includes(page) ? d.filter((p) => p !== page) : [...d, page] })
    },

    saveFlag({ id, ...f }) {
      const flags = get().book?.flags ?? []
      patchBook({
        flags: id ? flags.map((x) => (x.id === id ? { id, ...f } : x)) : [...flags, { id: uid(), ...f }],
      })
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

    toggleChapterDrawer(open) {
      set({ chapterDrawer: open ?? !get().chapterDrawer })
    },

    setFastScrolling(isFastScrolling) {
      if (get().isFastScrolling !== isFastScrolling) {
        set({ isFastScrolling })
      }
    },

    toggleFocusMode(on) {
      set({ focusMode: on ?? !get().focusMode })
    },

    async backupSanctuary() {
      const [books, contents, annotations, prefs] = await Promise.all([
        db.books.toArray(),
        db.contents.toArray(),
        db.annotations.toArray(),
        db.prefs.get('reader'),
      ])
      const payload = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        books,
        contents,
        annotations,
        prefs: prefs ?? DEFAULT_PREFS,
      }
      return JSON.stringify(payload, null, 2)
    },

    async restoreSanctuary(jsonString: string) {
      signalSave()
      const data = JSON.parse(jsonString)
      if (!Array.isArray(data.books) || !Array.isArray(data.contents)) {
        throw new Error('Invalid sanctuary backup file.')
      }
      await db.transaction('rw', db.books, db.contents, db.annotations, db.prefs, async () => {
        await db.books.clear()
        await db.contents.clear()
        await db.annotations.clear()
        await db.books.bulkPut(data.books)
        await db.contents.bulkPut(data.contents)
        if (Array.isArray(data.annotations)) {
          await db.annotations.bulkPut(data.annotations)
        }
        if (data.prefs) {
          await db.prefs.put(data.prefs, 'reader')
        }
      })
      const books = await db.books.orderBy('addedAt').toArray()
      set({
        books,
        book: null,
        pages: [],
        notes: [],
        prefs: data.prefs || DEFAULT_PREFS,
      })
    },
  }
})
