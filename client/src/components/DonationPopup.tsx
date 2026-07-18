import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isDonationPopupWindow, jerusalemDateKey } from '@ramadan-tournament/shared'
import { DONATE_PAGE_URL } from '../config/contactConfig'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { trackEvent } from '../utils/analytics'
import './DonationPopup.css'

const DATE_STORAGE_KEY = 'donationPopupShownDate'
const SESSION_STORAGE_KEY = 'donationPopupShownSession'

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

function markShown(todayKey: string): void {
  writeStorage(localStorage, DATE_STORAGE_KEY, todayKey)
  writeStorage(sessionStorage, SESSION_STORAGE_KEY, '1')
}

function shouldOfferPopup(now: Date = new Date()): boolean {
  if (!isDonationPopupWindow(now)) return false
  if (readStorage(sessionStorage, SESSION_STORAGE_KEY) === '1') return false
  const todayKey = jerusalemDateKey(now)
  if (readStorage(localStorage, DATE_STORAGE_KEY) === todayKey) return false
  return true
}

const DonationPopup = () => {
  const { showBanner, ready } = useCookieConsent()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const dismiss = () => {
    trackEvent('donation_popup_dismiss', { category: 'interaction' })
    setOpen(false)
  }

  const dialogRef = useFocusTrap(open, dismiss)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!ready || showBanner) return
    if (!shouldOfferPopup()) return

    const todayKey = jerusalemDateKey(new Date())
    markShown(todayKey)
    trackEvent('donation_popup_show', { category: 'interaction' })
    setOpen(true)
  }, [ready, showBanner])

  useEffect(() => {
    if (!open) return

    const appShell = document.querySelector('.app')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    appShell?.setAttribute('inert', '')

    return () => {
      document.body.style.overflow = previousOverflow
      appShell?.removeAttribute('inert')
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="donation-popup-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        ref={dialogRef}
        className="donation-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-popup-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="donation-popup-title" className="donation-popup-title">
          תתרמו לטורניר
        </h2>
        <p className="donation-popup-text">
          הטורניר רץ בהתנדבות למען הקהילה.
          <br />
          איסוף ותיעוד נתונים, עדכונים בזמן אמת ותחזוקת האתר.
        </p>
        <div className="donation-popup-actions">
          <a
            className="btn btn-donation-cta"
            href={DONATE_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('donation_popup_cta', { category: 'interaction' })
              setOpen(false)
            }}
          >
            לתרומה
          </a>
        </div>
        <button
          type="button"
          className="donation-popup-close"
          onClick={dismiss}
          aria-label="סגור"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  )
}

export default DonationPopup
