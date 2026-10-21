import Dexie, { type EntityTable, type Table } from 'dexie'

export const INKS = ['ochre', 'rose', 'sage', 'indigo', 'lilac'] as const
export type Ink = (typeof INKS)[number]
export type Kind = 'highlight' | 'squiggle' | 'bracket' | 'note'
export type Format = 'epub' | 'pdf' | 'md' | 'txt'
export type Theme = 'cream' | 'parchment' | 'sage' | 'midnight'
export type Font = 'garamond' | 'baskerville' | 'atkinson' | 'libron' | 'dyslexic'
export type Style = 'mla' | 'apa' | 'chicago'

export interface Flag { id: string; page: number; color: Ink; label: string }

export interface TocItem {
  id?: string
  title: string
  page: number
  pageNumber?: number
  href?: string
  level?: number
  children?: any[]
}

/** Light metadata row — shelf lists these without touching page content. */
export interface Book {
  id: string
  title: string
  author: string
  year: string
  publisher: string
  format: Format
  pageCount: number
  wordCount: number
  addedAt: number
  page: number // last page read (0-based)
  dogears: number[]
  flags: Flag[]
  legend: Record<Ink, string>
  prunedPages?: number[] // Phase 4: Non-destructive page exclusion layer
  toc?: TocItem[]
}

export interface Content {
  id: string
  pages: string[]
  rawFile?: Blob
}

/** Anchored by character offsets into a page's text content. */
export interface Annotation {
  id: string
  bookId: string
  page: number
  start: number
  end: number
  quote: string
  kind: Kind
  color: Ink
  note: string
  createdAt: number
}

export interface Prefs {
  theme: Theme
  font: Font
  size: number
  leading: number
  measure: number
  ink: Ink
  style: Style
  lastBook: string | null
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'cream', font: 'garamond', size: 20, leading: 1.7, measure: 66, ink: 'ochre', style: 'mla', lastBook: null,
}

export const DEFAULT_LEGEND: Record<Ink, string> = {
  ochre: 'Motif', rose: 'Rhetoric', sage: 'Setting', indigo: 'Character', lilac: 'Question',
}

class InklingDB extends Dexie {
  books!: EntityTable<Book, 'id'>
  contents!: EntityTable<Content, 'id'>
  annotations!: EntityTable<Annotation, 'id'>
  prefs!: Table<Prefs, string>

  constructor() {
    super('InklingDatabase')
    this.version(1).stores({ books: 'id, addedAt', contents: 'id', annotations: 'id, bookId', prefs: '' })
    this.version(2).stores({ books: 'id, addedAt', contents: 'id', annotations: 'id, bookId, page, [bookId+page]', prefs: '' })
  }
}

export const db = new InklingDB()

/**
 * Migration guardrail:
 * Checks if legacy 'inkling' database exists from before the permanent name lock.
 * If 'InklingDatabase' has no books, safely imports legacy records without data loss.
 */
export async function migrateLegacyDatabase(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false
  try {
    const currentCount = await db.books.count()
    if (currentCount > 0) return false

    const legacyExists = await Dexie.exists('inkling')
    if (!legacyExists) return false

    const legacyDb = new Dexie('inkling')
    await legacyDb.open()
    const tableNames = legacyDb.tables.map((t) => t.name)
    if (!tableNames.includes('books')) {
      legacyDb.close()
      return false
    }

    const legacyBooks = (await legacyDb.table('books').toArray()) as Book[]
    if (!legacyBooks || legacyBooks.length === 0) {
      legacyDb.close()
      return false
    }

    const legacyContents = tableNames.includes('contents')
      ? ((await legacyDb.table('contents').toArray()) as Content[])
      : []
    const legacyAnnotations = tableNames.includes('annotations')
      ? ((await legacyDb.table('annotations').toArray()) as Annotation[])
      : []
    const legacyPrefs = tableNames.includes('prefs')
      ? ((await legacyDb.table('prefs').toArray()) as Prefs[])
      : []

    await db.transaction('rw', db.books, db.contents, db.annotations, db.prefs, async () => {
      if (legacyBooks.length) await db.books.bulkPut(legacyBooks)
      if (legacyContents.length) await db.contents.bulkPut(legacyContents)
      if (legacyAnnotations.length) await db.annotations.bulkPut(legacyAnnotations)
      for (const p of legacyPrefs) {
        await db.prefs.put(p, 'reader')
      }
    })

    legacyDb.close()
    return true
  } catch (err) {
    console.warn('[InklingDatabase] Legacy database migration skipped:', err)
    return false
  }
}
