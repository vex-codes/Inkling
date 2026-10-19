import Dexie, { type EntityTable, type Table } from 'dexie'

export const INKS = ['ochre', 'rose', 'sage', 'indigo', 'lilac'] as const
export type Ink = (typeof INKS)[number]
export type Kind = 'highlight' | 'squiggle' | 'bracket' | 'note'
export type Format = 'epub' | 'pdf' | 'md' | 'txt'
export type Theme = 'cream' | 'parchment' | 'sage' | 'midnight'
export type Font = 'garamond' | 'baskerville' | 'atkinson'
export type Style = 'mla' | 'apa' | 'chicago'

export interface Flag { id: string; page: number; color: Ink; label: string }

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
}

export interface Content { id: string; pages: string[] }

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
    super('inkling')
    this.version(1).stores({ books: 'id, addedAt', contents: 'id', annotations: 'id, bookId', prefs: '' })
  }
}

export const db = new InklingDB()
