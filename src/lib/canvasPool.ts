/**
 * Memory-Safe PDF Page Rendering Pool
 * Capped at MAX_ACTIVE_CANVASES (default 4) to prevent GPU texture bloat and WebKit crashes.
 * Automatically evicts and releases the canvas farthest from the current viewport.
 */
export class CanvasMemoryPool {
  private static MAX_ACTIVE_CANVASES = 4
  private activeCanvases = new Map<number, HTMLCanvasElement>()

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

  public release(pageNumber: number): void {
    const canvas = this.activeCanvases.get(pageNumber)
    if (canvas) {
      canvas.width = 1
      canvas.height = 1 // Release GPU memory instantly
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
