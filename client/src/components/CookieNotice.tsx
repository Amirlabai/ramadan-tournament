import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { useFocusTrap } from '../hooks/useFocusTrap'
import './CookieNotice.css'

const CookieNotice = () => {
  const { showBanner, setConsent } = useCookieConsent()
  const dialogRef = useFocusTrap(showBanner, () => setConsent('essential'))
  const acceptRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showBanner) acceptRef.current?.focus()
  }, [showBanner])

  if (!showBanner) return null

  return (
    <div className="cookie-notice-backdrop" role="presentation" data-roleplay-bypass>
      <div
        ref={dialogRef}
        className="cookie-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-notice-title"
      >
        <h2 id="cookie-notice-title" className="cookie-notice-title">
          עוגיות ופרטיות
        </h2>
        <p className="cookie-notice-text">
          האתר משתמש בעוגיות חיוניות לתפעול, ובעוגיות אנליטיקה (Vercel Analytics ורישום אירועי שימוש בשרת) רק
          לאחר אישורכם. איסוף פרטי זהות לרישום לטורניר אינו תלוי בבאנר זה. לפרטים ראו{' '}
          <Link to="/privacy#cookies">מדיניות הפרטיות</Link> ו{' '}
          <Link to="/privacy#identity">פרטי זהות</Link>.
        </p>
        <div className="cookie-notice-actions">
          <button
            ref={acceptRef}
            type="button"
            className="btn btn-theme-green"
            onClick={() => setConsent('accepted')}
          >
            מאשר/ת הכל
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setConsent('essential')}
          >
            חיוניות בלבד
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieNotice
