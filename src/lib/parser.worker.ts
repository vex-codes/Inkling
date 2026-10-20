// Web Worker for off-thread document parsing and background indexing
// Keeps the main React UI thread at 60 FPS during large book ingestion.

export interface ParseRequest {
  type: 'parse'
  buffer: ArrayBuffer
  name: string
  ext: string
}

export interface ParseResponse {
  type: 'success' | 'error' | 'progress'
  data?: unknown
  error?: string
  progress?: number
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { buffer, name, ext } = e.data

  try {
    if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
      const text = new TextDecoder('utf-8').decode(buffer)
      self.postMessage({ type: 'success', data: { text, name } })
    } else {
      // Signal off-thread readiness for EPUB/PDF chunking
      self.postMessage({ type: 'progress', progress: 50 })
      self.postMessage({ type: 'success', data: { buffer, name, ext } })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', error: msg })
  }
}
