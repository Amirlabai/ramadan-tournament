import { useCallback, useRef, type TouchEvent } from 'react'

const SWIPE_THRESHOLD = 50
const SWIPE_RATIO = 1.25

/** Drawer on right: swipe finger right (positive dx) to close */
export function useDrawerSwipeClose(onClose: () => void, enabled: boolean) {
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    [enabled]
  )

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !startRef.current) return
      const dx = e.touches[0].clientX - startRef.current.x
      const dy = e.touches[0].clientY - startRef.current.y
      if (dx > SWIPE_THRESHOLD && dx > Math.abs(dy) * SWIPE_RATIO) {
        startRef.current = null
        onClose()
      }
    },
    [enabled, onClose]
  )

  const onTouchEnd = useCallback(() => {
    startRef.current = null
  }, [])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
