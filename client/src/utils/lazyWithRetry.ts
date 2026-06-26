import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'ChunkLoadError',
  'Loading chunk',
]

export function isChunkLoadError(message: string): boolean {
  const lower = message.toLowerCase()
  return CHUNK_ERROR_PATTERNS.some((pattern) =>
    lower.includes(pattern.toLowerCase()),
  )
}

function reloadOnce(): never {
  const storageKey = `chunk-reload:${import.meta.url}`
  if (!sessionStorage.getItem(storageKey)) {
    sessionStorage.setItem(storageKey, '1')
    window.location.reload()
  }
  throw new Error('Chunk load failed after reload')
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!isChunkLoadError(message)) {
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      try {
        return await factory()
      } catch (retryErr) {
        const retryMessage =
          retryErr instanceof Error ? retryErr.message : String(retryErr)
        if (isChunkLoadError(retryMessage)) {
          reloadOnce()
        }
        throw retryErr
      }
    }
  })
}
