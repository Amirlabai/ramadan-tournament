import { useId, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import { useNavActionIndicators } from '../contexts/NavActionIndicatorsContext'
import { resolveAssetUrl } from '../utils/assetUrl'
import { canAccessAdminPanel } from '../utils/tournamentUser'
import { getMobilePrimaryNavItems } from '../utils/mainNavItems'
import { trackEvent } from '../utils/analytics'
import AccessibleModal from './AccessibleModal'
import NavActionDot, {
  navLinkWithDotClass,
  withPendingActionLabel,
} from './NavActionDot'
import './MobileBottomNav.css'

function isPathActive(pathname: string, to: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/'
  const itemPath = to.replace(/\/$/, '') || '/'
  return normalized === itemPath
}

function scrollWindowToTop() {
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}

const MobileBottomNav = () => {
  const { user } = useAuth()
  const { paths, isGirls, isWorldCup } = useTournament()
  const { profileActionRequired, adminActionRequired } = useNavActionIndicators()
  const location = useLocation()
  const navigate = useNavigate()
  const [chooserOpen, setChooserOpen] = useState(false)
  const chooserTitleId = useId()
  const isAdmin = canAccessAdminPanel(user)
  const primaryItems = getMobilePrimaryNavItems({ isGirls, isWorldCup, paths })
  const avatarSrc = resolveAssetUrl(user?.avatarUrl) ?? null
  const profileActive =
    isPathActive(location.pathname, '/profile') ||
    isPathActive(location.pathname, '/admin') ||
    isPathActive(location.pathname, '/login')
  const profileDot = Boolean(user && (profileActionRequired || (isAdmin && adminActionRequired)))

  const trackNav = (to: string) => {
    trackEvent('nav_click', {
      category: 'browse',
      properties: { navTo: to, external: false, source: 'mobile_bottom' },
    })
  }

  const goTo = (to: string) => {
    trackNav(to)
    if (isPathActive(location.pathname, to)) {
      scrollWindowToTop()
      return
    }
    navigate(to)
    scrollWindowToTop()
  }

  const onPrimaryClick = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    goTo(to)
  }

  const onProfileClick = () => {
    if (!user) {
      goTo('/login')
      return
    }
    if (isAdmin) {
      if (profileActive) scrollWindowToTop()
      setChooserOpen(true)
      return
    }
    goTo('/profile')
  }

  const goChooser = (to: string) => {
    setChooserOpen(false)
    goTo(to)
  }

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="ניווט ראשי">
        <ul className="mobile-bottom-nav-list" role="list">
          {primaryItems.map((item) => {
            const active = isPathActive(location.pathname, item.to)
            return (
              <li key={item.to} className="mobile-bottom-nav-item">
                <Link
                  to={item.to}
                  className={`mobile-bottom-nav-link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                  onClick={(event) => onPrimaryClick(event, item.to)}
                >
                  <i className={`bi ${item.icon} mobile-bottom-nav-icon`} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
          <li className="mobile-bottom-nav-item">
            <button
              type="button"
              className={navLinkWithDotClass(
                'mobile-bottom-nav-link mobile-bottom-nav-link--profile',
                profileDot,
                profileActive ? 'is-active' : ''
              )}
              aria-current={profileActive ? 'page' : undefined}
              aria-haspopup={isAdmin ? 'dialog' : undefined}
              aria-expanded={isAdmin ? chooserOpen : undefined}
              aria-label={
                user
                  ? withPendingActionLabel(user.displayName || 'פרופיל שלי', profileDot)
                  : 'התחברות'
              }
              onClick={onProfileClick}
            >
              {user && avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="mobile-bottom-nav-avatar"
                />
              ) : (
                <i
                  className={`bi ${user ? 'bi-person' : 'bi-box-arrow-in-left'} mobile-bottom-nav-icon`}
                  aria-hidden="true"
                />
              )}
              {profileDot && <NavActionDot />}
            </button>
          </li>
        </ul>
      </nav>

      <AccessibleModal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        titleId={chooserTitleId}
        className="mobile-profile-chooser-modal"
      >
        <div className="modal-content mobile-profile-chooser">
          <div className="modal-header">
            <h2 className="modal-title fs-5" id={chooserTitleId}>
              בחר יעד
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="סגור"
              onClick={() => setChooserOpen(false)}
            />
          </div>
          <div className="modal-body d-flex flex-column gap-2">
            <button
              type="button"
              className={navLinkWithDotClass(
                'mobile-profile-chooser-btn',
                profileActionRequired
              )}
              onClick={() => goChooser('/profile')}
              aria-label={withPendingActionLabel('פרופיל שלי', profileActionRequired)}
            >
              <i className="bi bi-person me-2" aria-hidden="true" />
              פרופיל שלי
              {profileActionRequired && <NavActionDot />}
            </button>
            <button
              type="button"
              className={navLinkWithDotClass(
                'mobile-profile-chooser-btn',
                adminActionRequired
              )}
              onClick={() => goChooser('/admin')}
              aria-label={withPendingActionLabel('ניהול', adminActionRequired)}
            >
              <i className="bi bi-shield-check me-2" aria-hidden="true" />
              ניהול
              {adminActionRequired && <NavActionDot />}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </>
  )
}

export default MobileBottomNav
