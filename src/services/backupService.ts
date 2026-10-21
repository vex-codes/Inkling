// Digital Binder (.inkling) Archive Service
// Zero-backend, portable study binder packaging using JSZip for cross-device synchronization.

import JSZip from 'jszip'
import { db, DEFAULT_LEGEND, type Annotation, type Book, type TocItem } from '../lib/db.ts'
import { toMarkdown, countWords } from '../lib/text.ts'
import { ingest } from './bookIngestion.ts'

export interface BinderManifest {
  version: string
  id: string
  title: string
  author: string
  format: 'epub' | 'pdf' | 'md' | 'txt'
  totalUnits: number
  lastLocation: {
    cfi?: string | null
    pageNumber: number // 1-based display page
    pageIndex?: number // 0-based internal index
    percentage: number
  }
  year?: string
  publisher?: string
  dogears?: number[]
  flags?: Book['flags']
  legend?: Book['legend']
  prunedPages?: number[]
  toc?: TocItem[]
  exportedAt: string
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'Book'
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Step 3A: Export Complete Archive (exportBookArchive)
 * Packages book.bin, manifest.json, annotations.json, and pages.json into a .inkling zip archive.
 */
export async function exportBookArchive(bookId: string): Promise<void> {
  const book = await db.books.get(bookId)
  if (!book) {
    throw new Error(`Book with id ${bookId} not found in database.`)
  }

  const [content, annotations] = await Promise.all([
    db.contents.get(bookId),
    db.annotations.where('bookId').equals(bookId).toArray(),
  ])

  const pages = content?.pages ?? []
  const pageIndex = Math.max(0, Math.min(book.page ?? 0, Math.max(0, pages.length - 1)))
  const pageNumber = pageIndex + 1
  const percentage = book.pageCount > 0 ? Number((pageIndex / book.pageCount).toFixed(4)) : 0

  const manifest: BinderManifest = {
    version: '1.0',
    id: book.id,
    title: book.title,
    author: book.author,
    format: book.format,
    totalUnits: book.pageCount || pages.length,
    lastLocation: {
      cfi: null,
      pageNumber,
      pageIndex,
      percentage,
    },
    year: book.year,
    publisher: book.publisher,
    dogears: book.dogears ?? [],
    flags: book.flags ?? [],
    legend: book.legend ?? { ...DEFAULT_LEGEND },
    prunedPages: book.prunedPages ?? [],
    toc: book.toc ?? [],
    exportedAt: new Date().toISOString(),
  }

  // Determine book.bin payload
  let rawBlob: Blob
  if (content?.rawFile && content.rawFile.size > 0) {
    rawBlob = content.rawFile
  } else if (pages.length > 0) {
    // Synthesize binary from pre-paginated pages
    const textData = pages.join('\n\n<!-- PAGE_BREAK -->\n\n')
    rawBlob = new Blob([textData], { type: 'text/plain;charset=utf-8' })
  } else {
    rawBlob = new Blob([''], { type: 'application/octet-stream' })
  }

  const zip = new JSZip()
  zip.file('book.bin', rawBlob)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('annotations.json', JSON.stringify(annotations, null, 2))
  if (pages.length > 0) {
    zip.file('pages.json', JSON.stringify(pages))
  }

  const archiveBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = `${sanitizeFilename(book.title)}_Study_Binder.inkling`
  triggerDownload(archiveBlob, filename)
}

/**
 * Step 3B: Export Study Notes Only (exportStudyNotesMarkdown)
 * Generates and downloads a clean, structured .md study sheet containing quotations,
 * MLA formatted citations, highlight color tags, and attached margin thoughts.
 */
export async function exportStudyNotesMarkdown(bookId: string): Promise<void> {
  const book = await db.books.get(bookId)
  if (!book) {
    throw new Error(`Book with id ${bookId} not found in database.`)
  }

  const annotations = await db.annotations.where('bookId').equals(bookId).toArray()
  const md = toMarkdown(book, annotations, 'mla')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const filename = `${sanitizeFilename(book.title)}_Study_Notes.md`
  triggerDownload(blob, filename)
}

/**
 * Step 3C: Ingest & Hydrate Archive (importBookArchive)
 * Unpacks .inkling file, extracts manifest, annotations, and binary book content,
 * restores to Dexie IndexedDB, and returns the restored bookId.
 */
export async function importBookArchive(file: File): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch (err: unknown) {
    throw new Error('Failed to read archive. Make sure this is a valid .inkling Digital Binder file.')
  }

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) {
    throw new Error('Corrupt .inkling archive: missing manifest.json.')
  }

  const manifestText = await manifestFile.async('string')
  let manifest: BinderManifest
  try {
    manifest = JSON.parse(manifestText)
  } catch {
    throw new Error('Invalid manifest.json in .inkling archive.')
  }

  // Extract annotations
  const annotationsFile = zip.file('annotations.json')
  let annotations: Annotation[] = []
  if (annotationsFile) {
    try {
      const annotationsText = await annotationsFile.async('string')
      annotations = JSON.parse(annotationsText)
    } catch {
      console.warn('[backupService] Failed to parse annotations.json, proceeding with empty notes.')
    }
  }

  // Extract book.bin
  const bookBinFile = zip.file('book.bin')
  let bookBlob: Blob = new Blob([])
  if (bookBinFile) {
    bookBlob = await bookBinFile.async('blob')
  }

  // Extract pages.json
  const pagesFile = zip.file('pages.json')
  let pages: string[] = []
  if (pagesFile) {
    try {
      const pagesText = await pagesFile.async('string')
      pages = JSON.parse(pagesText)
    } catch {
      pages = []
    }
  }

  let prunedPages = manifest.prunedPages ?? []
  let toc = manifest.toc

  // Fallback: If pages.json is missing or empty, reconstruct pages using book.bin via ingest()
  if (pages.length === 0 && bookBlob.size > 0) {
    const ext = manifest.format || 'epub'
    const virtualFile = new File([bookBlob], `${manifest.title || 'document'}.${ext}`, {
      type: ext === 'pdf' ? 'application/pdf' : ext === 'epub' ? 'application/epub+zip' : 'text/plain',
    })
    const ingested = await ingest(virtualFile)
    pages = ingested.pages
    if (prunedPages.length === 0) prunedPages = ingested.prunedPages
    if (!toc || toc.length === 0) toc = ingested.toc
  }

  // Resolve reading position
  let pageIndex = 0
  if (typeof manifest.lastLocation?.pageIndex === 'number') {
    pageIndex = manifest.lastLocation.pageIndex
  } else if (typeof manifest.lastLocation?.pageNumber === 'number') {
    pageIndex = manifest.lastLocation.pageNumber - 1
  }

  if (pages.length > 0) {
    pageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1))
  }

  const bookId = manifest.id || crypto.randomUUID()
  const restoredBook: Book = {
    id: bookId,
    title: manifest.title || 'Untitled Book',
    author: manifest.author || 'Anonymous',
    year: manifest.year || '',
    publisher: manifest.publisher || '',
    format: manifest.format || 'epub',
    pageCount: pages.length || manifest.totalUnits || 1,
    wordCount: pages.reduce((n, p) => n + countWords(p), 0),
    addedAt: Date.now(),
    page: pageIndex,
    dogears: manifest.dogears ?? [],
    flags: manifest.flags ?? [],
    legend: manifest.legend ?? { ...DEFAULT_LEGEND },
    prunedPages,
    toc: toc ?? [],
  }

  // Ensure annotations are bound to the restored bookId
  const sanitizedAnnotations: Annotation[] = annotations.map((ann) => ({
    ...ann,
    id: ann.id || crypto.randomUUID(),
    bookId,
  }))

  await db.transaction('rw', db.books, db.contents, db.annotations, async () => {
    await db.books.put(restoredBook)
    await db.contents.put({
      id: restoredBook.id,
      pages,
      rawFile: bookBlob.size > 0 ? bookBlob : undefined,
    })
    if (sanitizedAnnotations.length > 0) {
      await db.annotations.bulkPut(sanitizedAnnotations)
    }
  })

  return restoredBook.id
}
