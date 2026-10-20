/**
 * Memory-Safe PDF Page Rendering Pool
 * Capped at MAX_ACTIVE_CANVASES = 3 to prevent GPU texture bloat and WebKit crashes.
 * Automatically evicts and releases the canvas farthest from the current viewport.
 */
export class CanvasMemoryPool {
  private static MAX_ACTIVE_CANVASES = 3
  private activeCanvases = new Map<number, HTMLCanvasElement>()
  private renderTasks = new Map<number, { cancel: () => void }>()
  private pdfPages = new Map<number, { cleanup?: () => void; destroy?: () => void }>()

  private findFurthestPage(targetPage: number): number {
    let furthestPage = -1
    let maxDistance = -1
    for (const pageNumber of this.activeCanvases.keys()) {
      const distance = Math.abs(pageNumber - targetPage)
      if (distance > maxDistance) {
        maxDistance = distance
        furthestPage = pageNumber
      }
    }
    return furthestPage
  }

  public acquire(pageNumber: number): HTMLCanvasElement {
    if (this.activeCanvases.has(pageNumber)) {
      return this.activeCanvases.get(pageNumber)!
    }
    if (this.activeCanvases.size >= CanvasMemoryPool.MAX_ACTIVE_CANVASES) {
      // Evict canvas farthest from current viewport
      const furthestPage = this.findFurthestPage(pageNumber)
      if (furthestPage !== -1) {
        this.release(furthestPage)
      }
    }
    const canvas = document.createElement('canvas')
    this.activeCanvases.set(pageNumber, canvas)
    return canvas
  }

  public registerTask(pageNumber: number, task: { cancel: () => void }): void {
    this.renderTasks.set(pageNumber, task)
  }

  public registerPdfPage(pageNumber: number, page: { cleanup?: () => void; destroy?: () => void }): void {
    this.pdfPages.set(pageNumber, page)
  }

  public release(pageNumber: number): void {
    const task = this.renderTasks.get(pageNumber)
    if (task) {
      try {
        task.cancel()
      } catch {
        // ignore
      }
      this.renderTasks.delete(pageNumber)
    }

    const page = this.pdfPages.get(pageNumber)
    if (page) {
      try {
        page.cleanup?.()
        page.destroy?.()
      } catch {
        // ignore
      }
      this.pdfPages.delete(pageNumber)
    }

    const canvas = this.activeCanvases.get(pageNumber)
    if (canvas) {
      // Reset dimensions to 0 to force WebKit/Blink to instantly deallocate the GPU backbuffer
      canvas.width = 0
      canvas.height = 0
      canvas.remove()
      this.activeCanvases.delete(pageNumber)
    }
  }

  public clear(): void {
    for (const pageNumber of Array.from(this.activeCanvases.keys())) {
      this.release(pageNumber)
    }
  }

  public getActiveCount(): number {
    return this.activeCanvases.size
  }
}

export const canvasPool = new CanvasMemoryPool()
