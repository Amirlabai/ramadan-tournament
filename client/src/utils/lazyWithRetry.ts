import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'ChunkLoadError',
  'Loading chunk',
  'Chunk load failed after reload',
]

export function chunkErrorMessage(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message)
      current = current.cause
    } else {
      parts.push(String(current))
      break
    }
  }
  return parts.join(' ')
}

export function isChunkLoadError(message: string): boolean {
  const lower = message.toLowerCase()
  return CHUNK_ERROR_PATTERNS.some((pattern) =>
    lower.includes(pattern.toLowerCase()),
  )
}

function reloadOnce(chunkId: string): never {
  const storageKey = `chunk-reload:${chunkId}`
  if (!sessionStorage.getItem(storageKey)) {
    sessionStorage.setItem(storageKey, '1')
    window.location.reload()
  }
  throw new Error('error loading dynamically imported module')
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  chunkId: string,
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory()
    } catch (err) {
      if (!isChunkLoadError(chunkErrorMessage(err))) {
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      try {
        return await factory()
      } catch (retryErr) {
        if (isChunkLoadError(chunkErrorMessage(retryErr))) {
          reloadOnce(chunkId)
        }
        throw retryErr
      }
    }
  })
}
