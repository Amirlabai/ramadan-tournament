import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import {
  getMainNavItems,
  getNavIndex,
  applyNavActionDots,
  filterMobileOverflowNavItems,
} from '../utils/mainNavItems'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useDrawerSwipeClose } from '../hooks/useDrawerSwipeClose'
import { canAccessAdminPanel } from '../utils/tournamentUser'
import { showBoysTournamentRulesNav } from '../utils/tournamentRulesNav'
import { useNavActionIndicators } from '../contexts/NavActionIndicatorsContext'
import { NavActionLink } from './NavActionDot'
import { isBigBossPublicPath } from '../utils/bigBossRoleplay'
import './TournamentSidebar.css'

interface TournamentSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  reducedMotion: boolean
}

const TournamentSidebar = ({
  open,
  onOpenChange,
  isMobile,
  reducedMotion,
}: TournamentSidebarProps) => {
  const { user } = useAuth()
  const { paths, isGirls, isWorldCup } = useTournament()
  const location = useLocation()
  const { profileActionRequired, adminActionRequired } = useNavActionIndicators()
  const showAdminNav = canAccessAdminPanel(user)
  const roleplayEnabled = !isGirls && !isWorldCup && isBigBossPublicPath(location.pathname)
  const allItems = applyNavActionDots(
    getMainNavItems({ isGirls, isWorldCup, paths, user, showAdminNav, roleplayEnabled }),
    { profile: profileActionRequired, admin: adminActionRequired }
  )
  const items = isMobile
    ? filterMobileOverflowNavItems(allItems, { isGirls, isWorldCup, paths })
    : allItems
  const activeIndex = getNavIndex(location.pathname, items)
  const panelRef = useFocusTrap(isMobile && open, () => onOpenChange(false))
  const close = () => onOpenChange(false)
  const drawerSwipe = useDrawerSwipeClose(close, isMobile && open)
  const isNavPathActive = (to: string) =>
    location.pathname === to || location.pathname === to.replace(/\/$/, '')

  const legalLinks = [
    { to: '/about', label: 'אודות' },
    ...(showBoysTournamentRulesNav(isGirls, isWorldCup)
      ? [{ to: '/rules', label: 'תקנון' }]
      : []),
    { to: '/privacy', label: 'פרטיות' },
    { to: '/terms', label: 'תנאים' },
    { to: '/accessibility', label: 'נגישות' },
  ]

  const sidebarContent = (
    <>
      <ul className="tournament-sidebar-list" role="list">
        {items.map((item) => (
          <li key={`${item.to}::${item.label}`} className="tournament-sidebar-item">
            <NavActionLink
              to={item.to}
              label={item.label}
              className="tournament-sidebar-link"
              extraClassName={item.className}
              active={!item.external && isNavPathActive(item.to)}
              showActionDot={item.showActionDot}
              external={item.external}
              trackNav
              dataNavTarget={item.navTarget}
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
              key={`${item.to}::${item.label}`}
              className={`tournament-sidebar-dot ${i === activeIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {isMobile && open && (
        <button
          type="button"
          className="tournament-sidebar-backdrop"
          aria-label="סגור תפריט. הקש על הרקע"
          onClick={close}
        />
      )}
      <aside
        id="tournament-sidebar-panel"
        ref={panelRef}
        className={`tournament-sidebar ${isMobile ? 'tournament-sidebar--drawer' : 'tournament-sidebar--desktop'} ${open ? 'is-open' : ''} ${reducedMotion ? 'no-motion' : ''}`}
        aria-label={isMobile ? 'תפריט נוסף' : 'ניווט ראשי'}
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
        <nav aria-label={isMobile ? 'קישורים נוספים' : 'ניווט ראשי'}>{sidebarContent}</nav>
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
