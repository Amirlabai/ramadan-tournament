import { useEffect, useRef, type RefObject } from 'react'

const SWIPE_THRESHOLD = 60
const SWIPE_RATIO = 1.5

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(
    'a, button, input, select, textarea, label, [role="button"], [contenteditable="true"]'
  )
}

interface SwipeOpenOptions {
  onOpen: () => void
  disabled?: boolean
}

/** Drawer on right: swipe finger left (negative dx) on main content to open */
export function useSwipeOpenDrawer(
  elementRef: RefObject<HTMLElement | null>,
  { onOpen, disabled = false }: SwipeOpenOptions
) {
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    const el = elementRef.current
    if (!el || disabled) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      if (isInteractiveTarget(e.target)) return
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!startRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startRef.current.x
      const dy = touch.clientY - startRef.current.y
      startRef.current = null

      if (dx > -SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return
      onOpenRef.current()
    }

    const onTouchCancel = () => {
      startRef.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [elementRef, disabled])
}
