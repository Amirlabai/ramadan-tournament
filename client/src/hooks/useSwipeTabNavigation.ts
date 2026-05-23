import { useEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getNavIndex, type NavItem } from '../utils/mainNavItems'

const SWIPE_THRESHOLD = 60
const SWIPE_RATIO = 1.5
const MAX_SHIFT_PX = 8

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(
    'a, button, input, select, textarea, label, [role="button"], [contenteditable="true"]'
  )
}

interface SwipeOptions {
  items: NavItem[]
  disabled?: boolean
}

export function useSwipeTabNavigation(
  elementRef: RefObject<HTMLElement | null>,
  { items, disabled = false }: SwipeOptions
) {
  const navigate = useNavigate()
  const location = useLocation()
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = elementRef.current
    if (!el || disabled) return

    const index = getNavIndex(location.pathname, items)
    if (index < 0) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      if (isInteractiveTarget(e.target)) return
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!startRef.current || reducedMotion) return
      const dx = e.touches[0].clientX - startRef.current.x
      const dy = e.touches[0].clientY - startRef.current.y
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        const clamped = Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, dx * 0.15))
        el.style.transform = `translateX(${clamped}px)`
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      el.style.transform = ''
      if (!startRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startRef.current.x
      const dy = touch.clientY - startRef.current.y
      startRef.current = null

      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) {
        return
      }

      const currentIndex = getNavIndex(location.pathname, items)
      if (currentIndex < 0) return

      // RTL: swipe right (positive dx) → previous; swipe left → next
      if (dx > 0 && currentIndex > 0) {
        navigate(items[currentIndex - 1].to)
      } else if (dx < 0 && currentIndex < items.length - 1) {
        navigate(items[currentIndex + 1].to)
      }
    }

    const onTouchCancel = () => {
      startRef.current = null
      el.style.transform = ''
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.style.transform = ''
    }
  }, [elementRef, items, disabled, location.pathname, navigate, reducedMotion])
}
