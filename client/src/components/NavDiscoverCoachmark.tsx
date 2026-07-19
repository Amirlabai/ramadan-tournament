import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import {
  clearDiscoverNavHighlight,
  computeDiscoverCoachmarkAnchor,
  DRAWER_SETTLE_MS,
  queryDiscoverNavTargets,
  setDiscoverNavHighlight,
  type DiscoverNavTarget,
} from '../utils/navDiscoverHighlight'
import './NavDiscoverCoachmark.css'

export type NavDiscoverCloseReason = 'dismiss' | 'cta'
export type NavDiscoverKind = 'albums' | 'stats'

type NavDiscoverCoachmarkProps = {
  open: boolean
  kind: NavDiscoverKind
  isMobile: boolean
  /** Albums only: open hamburger so media-docs links are visible. */
  openMobileDrawer?: () => void
  mobileDrawerOpen?: boolean
  /** Fired once the tip is painted with a real nav target (mark storage here). */
  onShown: () => void
  /** No target / failed settle — do not mark storage. */
  onAbort: () => void
  onClose: (reason: NavDiscoverCloseReason) => void
}

type AnchorPos = { top: number; left: number }

const COPY: Record<
  NavDiscoverKind,
  {
    target: DiscoverNavTarget
    titleId: string
    title: string
    body: string
    bodyMobile?: string
    openDrawerOnMobile: boolean
    /** In-app path that means the tip goal was reached (stats). */
    successPath?: string
  }
> = {
  albums: {
    target: 'media-docs',
    titleId: 'discover-coachmark-albums-title',
    title: 'תיעוד מהמגרש',
    body: 'המשחקים בסופי השבוע.\nכאן תמצאו את התמונות. כדאי להציץ!',
    openDrawerOnMobile: true,
  },
  stats: {
    target: 'stats',
    titleId: 'discover-coachmark-stats-title',
    title: 'סטטיסטיקות',
    body: 'בדקו את סטטיסטיקות העונה.\nטבלאות ומצטיינים כאן בצד.',
    bodyMobile: 'בדקו את סטטיסטיקות העונה.\nטבלאות ומצטיינים כאן למטה.',
    openDrawerOnMobile: false,
    successPath: '/stats',
  },
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/'
}

/**
 * Anchored tip next to a nav target (desktop) or bottom statement (mobile).
 * Highlights the control; does not navigate. Links stay clickable.
 */
const NavDiscoverCoachmark = ({
  open,
  kind,
  isMobile,
  openMobileDrawer,
  mobileDrawerOpen = false,
  onShown,
  onAbort,
  onClose,
}: NavDiscoverCoachmarkProps) => {
  const copy = COPY[kind]
  const { pathname } = useLocation()
  const [mounted, setMounted] = useState(false)
  const [anchor, setAnchor] = useState<AnchorPos | null>(null)
  const [ready, setReady] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const targetClickedRef = useRef(false)
  const shownRef = useRef(false)
  const closedRef = useRef(false)
  const onShownRef = useRef(onShown)
  const onAbortRef = useRef(onAbort)
  const onCloseRef = useRef(onClose)
  onShownRef.current = onShown
  onAbortRef.current = onAbort
  onCloseRef.current = onClose

  const closeOnce = (reason: NavDiscoverCloseReason) => {
    if (closedRef.current) return
    closedRef.current = true
    onCloseRef.current(reason)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setReady(false)
      setAnchor(null)
      shownRef.current = false
      targetClickedRef.current = false
      closedRef.current = false
      clearDiscoverNavHighlight()
      return
    }

    closedRef.current = false
    let cancelled = false
    let settleTimer: ReturnType<typeof setTimeout> | null = null
    triggerRef.current = document.activeElement as HTMLElement | null

    const activate = () => {
      if (cancelled) return
      if (!setDiscoverNavHighlight(copy.target)) {
        onAbortRef.current()
        return
      }
      if (!isMobile) {
        const nextAnchor = computeDiscoverCoachmarkAnchor(copy.target)
        if (!nextAnchor) {
          clearDiscoverNavHighlight()
          onAbortRef.current()
          return
        }
        setAnchor(nextAnchor)
      } else {
        setAnchor(null)
      }
      setReady(true)
      if (!shownRef.current) {
        shownRef.current = true
        onShownRef.current()
      }
    }

    if (isMobile && copy.openDrawerOnMobile && openMobileDrawer) {
      openMobileDrawer()
      settleTimer = setTimeout(activate, DRAWER_SETTLE_MS)
    } else {
      activate()
    }

    return () => {
      cancelled = true
      if (settleTimer) clearTimeout(settleTimer)
      clearDiscoverNavHighlight()
      const trigger = triggerRef.current
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus()
      }
    }
  }, [open, isMobile, openMobileDrawer, copy.openDrawerOnMobile, copy.target])

  useEffect(() => {
    if (!open || !ready || isMobile) return
    const update = () => {
      const next = computeDiscoverCoachmarkAnchor(copy.target)
      if (next) setAnchor(next)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, ready, isMobile, copy.target])

  useEffect(() => {
    if (!open || !ready) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOnce('dismiss')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, ready])

  useEffect(() => {
    if (!open || !ready) return
    const onClickCapture = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(
        `[data-nav-target="${copy.target}"]`
      )
      if (!el) return
      targetClickedRef.current = true
      closeOnce('cta')
    }
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [open, ready, copy.target])

  useEffect(() => {
    if (!open || !ready || !copy.successPath) return
    if (normalizePath(pathname) === copy.successPath) {
      closeOnce('cta')
    }
  }, [open, ready, pathname, copy.successPath])

  useEffect(() => {
    if (!open || !isMobile || !ready || !copy.openDrawerOnMobile) return
    if (mobileDrawerOpen) return
    if (targetClickedRef.current) return
    closeOnce('dismiss')
  }, [open, isMobile, ready, mobileDrawerOpen, copy.openDrawerOnMobile])

  if (!open || !mounted || !ready) return null
  if (!isMobile && !anchor) return null
  if (isMobile && queryDiscoverNavTargets(copy.target).length === 0) return null

  const showDownPointer = isMobile && kind === 'stats'
  const body = isMobile && copy.bodyMobile ? copy.bodyMobile : copy.body

  return createPortal(
    <div className="discover-coachmark-root" role="presentation">
      <div
        ref={panelRef}
        className={`discover-coachmark${isMobile ? ' discover-coachmark--mobile' : ' discover-coachmark--desktop'}`}
        role="note"
        aria-labelledby={copy.titleId}
        style={
          !isMobile && anchor
            ? { top: anchor.top, left: anchor.left }
            : undefined
        }
      >
        {!isMobile && (
          <span className="discover-coachmark-pointer" aria-hidden="true" />
        )}
        {showDownPointer && (
          <span
            className="discover-coachmark-pointer discover-coachmark-pointer--down"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          className="discover-coachmark-close"
          onClick={() => closeOnce('dismiss')}
          aria-label="סגור"
        >
          ×
        </button>
        <h2 id={copy.titleId} className="discover-coachmark-title">
          {copy.title}
        </h2>
        <p className="discover-coachmark-text">{body}</p>
        <button
          type="button"
          className="btn btn-donation-cta discover-coachmark-cta"
          onClick={() => closeOnce('cta')}
        >
          הבנתי
        </button>
      </div>
    </div>,
    document.body
  )
}

export default NavDiscoverCoachmark
