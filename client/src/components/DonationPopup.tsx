import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DONATE_PAGE_URL } from '../config/contactConfig'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { trackEvent } from '../utils/analytics'
import './DonationPopup.css'

export type DonationPopupCloseReason = 'dismiss' | 'cta'

type DonationPopupProps = {
  open: boolean
  onClose: (reason: DonationPopupCloseReason) => void
}

/** Presentational donate dialog — timing/storage owned by EngagementNudgeHost. */
const DonationPopup = ({ open, onClose }: DonationPopupProps) => {
  const [mounted, setMounted] = useState(false)

  const dismiss = () => {
    trackEvent('donation_popup_dismiss', { category: 'interaction' })
    onClose('dismiss')
  }

  const dialogRef = useFocusTrap(open, dismiss)

  useEffect(() => {
    setMounted(true)
  }, [])

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
              onClose('cta')
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
