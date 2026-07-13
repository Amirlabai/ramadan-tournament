import { useCallback, useEffect, useState } from 'react'

/** Keep in sync with CSS `@media (max-width: 768px)`. */
const MOBILE_MQ = '(max-width: 768px)'

export function useMediaMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const handler = () => setMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mobile
}

export function useSidebarDrawer() {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaMobile()
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

  return {
    open,
    setOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    isMobile,
    reducedMotion,
  }
}
