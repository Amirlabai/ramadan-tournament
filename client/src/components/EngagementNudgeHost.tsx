import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isAlbumsDiscoverWeekday,
  isStatsDiscoverWeekend,
} from '@ramadan-tournament/shared'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { trackEvent } from '../utils/analytics'
import {
  markAlbumsDiscoverShown,
  markAlbumsDiscoverNeverShow,
  markDonationPopupShown,
  markStatsDiscoverShown,
  shouldOfferAlbumsDiscover,
  shouldOfferDonationPopup,
  shouldOfferStatsDiscover,
} from '../utils/engagementNudgeStorage'
import NavDiscoverCoachmark from './NavDiscoverCoachmark'
import DonationPopup, { type DonationPopupCloseReason } from './DonationPopup'
import './navDiscoverHighlight.css'

type Phase = 'donate' | 'albums' | 'stats' | null

type EngagementNudgeHostProps = {
  openMobileDrawer: () => void
  isMobile: boolean
  mobileDrawerOpen: boolean
}

/**
 * Boys-only: sequences donate (Fri/Sat ≥17:00) then stats tip, or weekday albums tip.
 * Discover tips mark storage only after the coachmark paints with a real nav target.
 */
const EngagementNudgeHost = ({
  openMobileDrawer,
  isMobile,
  mobileDrawerOpen,
}: EngagementNudgeHostProps) => {
  const { showBanner, ready } = useCookieConsent()
  const { pathname } = useLocation()
  const [phase, setPhase] = useState<Phase>(null)
  const pendingStatsAfterDonateRef = useRef(false)
  const albumsFailedRef = useRef(false)
  const statsFailedRef = useRef(false)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (!ready || showBanner) return
    if (phase !== null) return

    const now = new Date()

    if (
      isAlbumsDiscoverWeekday(now) &&
      shouldOfferAlbumsDiscover(now) &&
      !albumsFailedRef.current
    ) {
      setPhase('albums')
      return
    }

    if (!isStatsDiscoverWeekend(now)) return

    if (shouldOfferDonationPopup(now)) {
      markDonationPopupShown(now)
      trackEvent('donation_popup_show', { category: 'interaction' })
      pendingStatsAfterDonateRef.current = true
      setPhase('donate')
      return
    }

    if (
      shouldOfferStatsDiscover(pathname, now) &&
      !statsFailedRef.current
    ) {
      setPhase('stats')
    }
  }, [ready, showBanner, pathname, phase])

  const tryOpenStatsTip = useCallback(() => {
    const now = new Date()
    if (statsFailedRef.current) return
    if (!shouldOfferStatsDiscover(pathnameRef.current, now)) return
    setPhase('stats')
  }, [])

  const onDonateClose = (_reason: DonationPopupCloseReason) => {
    setPhase(null)
    if (!pendingStatsAfterDonateRef.current) return
    pendingStatsAfterDonateRef.current = false
    queueMicrotask(() => {
      tryOpenStatsTip()
    })
  }

  const onAlbumsShown = useCallback(() => {
    markAlbumsDiscoverShown()
    trackEvent('albums_discover_show', { category: 'interaction' })
  }, [])

  const onStatsShown = useCallback(() => {
    markStatsDiscoverShown()
    trackEvent('stats_discover_show', { category: 'interaction' })
  }, [])

  const onAlbumsAbort = useCallback(() => {
    albumsFailedRef.current = true
    setPhase(null)
  }, [])

  const onStatsAbort = useCallback(() => {
    statsFailedRef.current = true
    setPhase(null)
  }, [])

  const onAlbumsClose = useCallback((reason: 'dismiss' | 'cta', dontShowAgain?: boolean) => {
    trackEvent(
      reason === 'cta' ? 'albums_discover_cta' : 'albums_discover_dismiss',
      { category: 'interaction' }
    )
    if (dontShowAgain) {
      markAlbumsDiscoverNeverShow()
    }
    setPhase(null)
  }, [])

  const onStatsClose = useCallback((reason: 'dismiss' | 'cta') => {
    trackEvent(
      reason === 'cta' ? 'stats_discover_cta' : 'stats_discover_dismiss',
      { category: 'interaction' }
    )
    setPhase(null)
  }, [])

  return (
    <>
      <DonationPopup open={phase === 'donate'} onClose={onDonateClose} />
      <NavDiscoverCoachmark
        open={phase === 'albums'}
        kind="albums"
        isMobile={isMobile}
        openMobileDrawer={openMobileDrawer}
        mobileDrawerOpen={mobileDrawerOpen}
        onShown={onAlbumsShown}
        onAbort={onAlbumsAbort}
        onClose={onAlbumsClose}
      />
      <NavDiscoverCoachmark
        open={phase === 'stats'}
        kind="stats"
        isMobile={isMobile}
        onShown={onStatsShown}
        onAbort={onStatsAbort}
        onClose={onStatsClose}
      />
    </>
  )
}

export default EngagementNudgeHost
