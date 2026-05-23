import { useCallback, useEffect, useRef, useState } from 'react'

const MOBILE_BREAKPOINT = 768
const DRAG_OPEN_THRESHOLD = 40

export function useMediaMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches : false
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = () => setMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mobile
}

export function useSidebarDrawer() {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaMobile()
  const dragStartX = useRef<number | null>(null)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const openDrawer = useCallback(() => setOpen(true), [])
  const closeDrawer = useCallback(() => setOpen(false), [])
  const toggleDrawer = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!isMobile) setOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const onHandlePointerDown = useCallback((clientX: number) => {
    dragStartX.current = clientX
  }, [])

  const onHandlePointerMove = useCallback(
    (clientX: number) => {
      if (dragStartX.current === null) return
      const dx = dragStartX.current - clientX
      if (dx > DRAG_OPEN_THRESHOLD) openDrawer()
    },
    [openDrawer]
  )

  const onHandlePointerUp = useCallback(() => {
    dragStartX.current = null
  }, [])

  return {
    open,
    setOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    isMobile,
    reducedMotion,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
  }
}
