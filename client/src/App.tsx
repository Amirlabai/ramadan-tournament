import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import { useRef } from 'react'
import Dashboard from './pages/Dashboard'
import Teams from './pages/Teams'
import Schedule from './pages/Schedule'
import Stats from './pages/Stats'
import Login from './pages/admin/Login'
import AdminPanel from './pages/admin/AdminPanel'
import Profile from './pages/Profile'
import MVPs from './pages/MVPs'
import TournamentSidebar from './components/TournamentSidebar'
import TournamentSwitcher from './components/TournamentSwitcher'
import NewsBanner from './components/NewsBanner'
import {
  TournamentProvider,
  TournamentPreferenceRedirect,
  useTournament,
} from './contexts/TournamentContext'
import GirlsHome from './pages/girls/GirlsHome'
import GirlsTeams from './pages/girls/GirlsTeams'
import GirlsNews from './pages/girls/GirlsNews'
import GirlsArchive from './pages/girls/GirlsArchive'
import Footer from './components/Footer'
import AlarmsWidget from './components/AlarmsWidget'
import ScrollToTop from './components/ScrollToTop'
import PlayerZone from './pages/PlayerZone'
import Archive from './pages/Archive'
import Accessibility from './pages/Accessibility'
import About from './pages/About'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import CookieNotice from './components/CookieNotice'
import { useCookieConsent } from './hooks/useCookieConsent'
import { useSidebarDrawer } from './hooks/useSidebarDrawer'
import { useSwipeTabNavigation } from './hooks/useSwipeTabNavigation'
import { getMainNavItems } from './utils/mainNavItems'
import { useAuth } from './contexts/AuthContext'
import './App.css'
import { Analytics } from '@vercel/analytics/react'
import { useState } from 'react'

function AppRoutes() {
  const location = useLocation()
  return (
    <RouteErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/mvps" element={<MVPs />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/player-zone" element={<PlayerZone />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/girls" element={<GirlsHome />} />
        <Route path="/teams-girls" element={<GirlsTeams />} />
        <Route path="/news-girls" element={<GirlsNews />} />
        <Route path="/archive-girls" element={<GirlsArchive />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </RouteErrorBoundary>
  )
}

function AppShell() {
  const [activeWidget, setActiveWidget] = useState<'none' | 'alarms'>('none')
  const { isGirls, paths } = useTournament()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin' || user?.role === 'admin'
  const { consent } = useCookieConsent()
  const mainRef = useRef<HTMLElement>(null)
  const {
    open: drawerOpen,
    setOpen: setDrawerOpen,
    isMobile,
    reducedMotion,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
  } = useSidebarDrawer()

  const navItems = getMainNavItems({ isGirls, paths, user, isAdmin })

  useSwipeTabNavigation(mainRef, {
    items: navItems,
    disabled: !isMobile || drawerOpen,
  })

  return (
    <>
      <TournamentPreferenceRedirect />
      <div className="app" dir="rtl" data-tournament={isGirls ? 'girls' : 'boys'}>
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>
        <AlarmsWidget
          isActive={activeWidget === 'alarms'}
          onToggle={(active) => setActiveWidget(active ? 'alarms' : 'none')}
        />
        <div className="header-news-wrapper">
          <div className="container-fluid p-0">
            <header className="tournament-header text-center py-4">
              <img
                src="/to-be-logo.svg"
                className="header-side-logo left"
                alt="לוגו טורניר נצ'מאז"
              />
              <img
                src="/Flag_of_Adygea.svg"
                className="header-side-logo right"
                alt="דגל אדיגיה"
              />
              <h1 className="display-4 fw-bold">
                טורניר קיץ
                <br />
                2026
              </h1>
              {isGirls && (
                <p className="tournament-subtitle mb-0">טורניר בנות — נקודות</p>
              )}
              <TournamentSwitcher />
            </header>
          </div>
          <NewsBanner />
        </div>
        <div className="container-fluid app-shell-container">
          <div className="app-body">
            <main id="main-content" ref={mainRef} tabIndex={-1}>
              <AppRoutes />
            </main>
            <TournamentSidebar
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              isMobile={isMobile}
              reducedMotion={reducedMotion}
              onHandlePointerDown={onHandlePointerDown}
              onHandlePointerMove={onHandlePointerMove}
              onHandlePointerUp={onHandlePointerUp}
            />
          </div>
        </div>
        <Footer />
        <ScrollToTop />
        {consent === 'accepted' && <Analytics />}
      </div>
    </>
  )
}

function App() {
  return (
    <Router>
      <CookieNotice />
      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/accessibility" element={<Accessibility />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route
          path="/*"
          element={
            <TournamentProvider>
              <AppShell />
            </TournamentProvider>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
