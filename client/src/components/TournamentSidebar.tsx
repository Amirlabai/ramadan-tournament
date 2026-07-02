import type { MouseEvent, TouchEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import { getMainNavItems, getNavIndex, applyNavActionDots } from '../utils/mainNavItems'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useDrawerSwipeClose } from '../hooks/useDrawerSwipeClose'
import { canAccessAdminPanel } from '../utils/tournamentUser'
import { useNavActionIndicators } from '../contexts/NavActionIndicatorsContext'
import { NavActionLink } from './NavActionDot'
import './TournamentSidebar.css'

interface TournamentSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  reducedMotion: boolean
  onHandlePointerDown: (clientX: number) => void
  onHandlePointerMove: (clientX: number) => void
  onHandlePointerUp: () => void
}

const TournamentSidebar = ({
  open,
  onOpenChange,
  isMobile,
  reducedMotion,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
}: TournamentSidebarProps) => {
  const { user } = useAuth()
  const { paths, isGirls, isWorldCup } = useTournament()
  const { profileActionRequired, adminActionRequired } = useNavActionIndicators()
  const showAdminNav = canAccessAdminPanel(user)
  const items = applyNavActionDots(
    getMainNavItems({ isGirls, isWorldCup, paths, user, showAdminNav }),
    { profile: profileActionRequired, admin: adminActionRequired }
  )
  const location = useLocation()
  const activeIndex = getNavIndex(location.pathname, items)
  const panelRef = useFocusTrap(isMobile && open, () => onOpenChange(false))
  const close = () => onOpenChange(false)
  const drawerSwipe = useDrawerSwipeClose(close, isMobile && open)
  const isNavPathActive = (to: string) =>
    location.pathname === to || location.pathname === to.replace(/\/$/, '')

  const legalLinks = [
    { to: '/about', label: 'אודות' },
    { to: '/privacy', label: 'פרטיות' },
    { to: '/terms', label: 'תנאים' },
    { to: '/accessibility', label: 'נגישות' },
  ]

  const sidebarContent = (
    <>
      <ul className="tournament-sidebar-list" role="list">
        {items.map((item) => (
          <li key={item.to} className="tournament-sidebar-item">
            <NavActionLink
              to={item.to}
              label={item.label}
              className="tournament-sidebar-link"
              extraClassName={item.className}
              active={isNavPathActive(item.to)}
              showActionDot={item.showActionDot}
              trackNav
              onClick={isMobile ? close : undefined}
            />
          </li>
        ))}
      </ul>
      <div className="tournament-sidebar-legal" aria-label="קישורים משפטיים">
        {legalLinks.map((link) => (
          <NavActionLink
            key={link.to}
            to={link.to}
            label={link.label}
            className="tournament-sidebar-link"
            active={isNavPathActive(link.to)}
            onClick={isMobile ? close : undefined}
          />
        ))}
      </div>
      {activeIndex >= 0 && items.length > 1 && (
        <div
          className="tournament-sidebar-dots"
          aria-hidden="true"
          title={`עמוד ${activeIndex + 1} מתוך ${items.length}`}
        >
          {items.map((item, i) => (
            <span
              key={item.to}
              className={`tournament-sidebar-dot ${i === activeIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      )}
    </>
  )

  const handleTouchStart = (e: TouchEvent) => {
    onHandlePointerDown(e.touches[0].clientX)
  }
  const handleTouchMove = (e: TouchEvent) => {
    onHandlePointerMove(e.touches[0].clientX)
  }
  const handleMouseDown = (e: MouseEvent) => {
    onHandlePointerDown(e.clientX)
  }
  const handleMouseMove = (e: MouseEvent) => {
    if (e.buttons === 1) onHandlePointerMove(e.clientX)
  }

  return (
    <>
      {isMobile && (
        <>
          <button
            type="button"
            className={`tournament-sidebar-handle ${open ? 'is-open' : ''}`}
            aria-label={open ? 'סגור תפריט ניווט' : 'פתח תפריט ניווט'}
            aria-expanded={open}
            aria-controls="tournament-sidebar-panel"
            onClick={() => onOpenChange(!open)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={onHandlePointerUp}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={onHandlePointerUp}
            onMouseLeave={onHandlePointerUp}
          >
            <span className="tournament-sidebar-handle-bar" aria-hidden="true" />
            <span className="tournament-sidebar-handle-bar" aria-hidden="true" />
            <span className="tournament-sidebar-handle-bar" aria-hidden="true" />
          </button>
          {open && (
            <button
              type="button"
              className="tournament-sidebar-backdrop"
              aria-label="סגור תפריט — הקש על הרקע"
              onClick={close}
            />
          )}
        </>
      )}
      <aside
        id="tournament-sidebar-panel"
        ref={panelRef}
        className={`tournament-sidebar ${isMobile ? 'tournament-sidebar--drawer' : 'tournament-sidebar--desktop'} ${open ? 'is-open' : ''} ${reducedMotion ? 'no-motion' : ''}`}
        aria-label="ניווט ראשי"
        aria-hidden={isMobile && !open}
        onTouchStart={drawerSwipe.onTouchStart}
        onTouchMove={drawerSwipe.onTouchMove}
        onTouchEnd={drawerSwipe.onTouchEnd}
      >
        {isMobile && (
          <div className="tournament-sidebar-drawer-head">
            <h2 className="tournament-sidebar-drawer-title">תפריט</h2>
            <p className="tournament-sidebar-drawer-hint">החלק ימינה או הקש על הרקע לסגירה</p>
          </div>
        )}
        <nav aria-label="ניווט ראשי">{sidebarContent}</nav>
        {isMobile && (
          <button
            type="button"
            className="tournament-sidebar-drawer-close-bottom"
            onClick={close}
            aria-label="סגור תפריט ניווט"
          >
            סגור
          </button>
        )}
      </aside>
    </>
  )
}

export default TournamentSidebar
