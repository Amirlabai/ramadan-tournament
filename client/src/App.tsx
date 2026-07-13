import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom'
import { useRef, Suspense } from 'react'
import PageLoading from './components/PageLoading'
import { lazyWithRetry } from './utils/lazyWithRetry'
import Dashboard from './pages/Dashboard'
import Teams from './pages/Teams'
import Schedule from './pages/Schedule'
import Stats from './pages/Stats'
import MVPs from './pages/MVPs'

const Login = lazyWithRetry('Login', () => import('./pages/admin/Login'))
const ForgotPassword = lazyWithRetry('ForgotPassword', () => import('./pages/ForgotPassword'))
const ResetPassword = lazyWithRetry('ResetPassword', () => import('./pages/ResetPassword'))
const AdminPanel = lazyWithRetry('AdminPanel', () => import('./pages/admin/AdminPanel'))
const Profile = lazyWithRetry('Profile', () => import('./pages/Profile'))
const PlayerZone = lazyWithRetry('PlayerZone', () => import('./pages/PlayerZone'))
import TournamentSidebar from './components/TournamentSidebar'
import TournamentSwitcher from './components/TournamentSwitcher'
import MobileBottomNav from './components/MobileBottomNav'
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
import WorldCupDashboard from './pages/worldcup/WorldCupDashboard'
import WorldCupTeams from './pages/worldcup/WorldCupTeams'
import WorldCupSchedule from './pages/worldcup/WorldCupSchedule'
import WorldCupStats from './pages/worldcup/WorldCupStats'
import { worldCupEnabled, worldCupOnly, worldCupOnlyRedirect } from './utils/worldCupEnabled'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Archive from './pages/Archive'
import Accessibility from './pages/Accessibility'
import About from './pages/About'
import TournamentRules from './pages/TournamentRules'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import CookieNotice from './components/CookieNotice'
import AccessibilityToolbar from './components/AccessibilityToolbar'
import { useCookieConsent } from './hooks/useCookieConsent'
import { useSidebarDrawer } from './hooks/useSidebarDrawer'
import { useSwipeOpenDrawer } from './hooks/useSwipeOpenDrawer'
import { NavActionIndicatorsProvider } from './contexts/NavActionIndicatorsContext'
import './App.css'
import { Analytics } from '@vercel/analytics/react'
import { useEffect } from 'react'
import { useAnalyticsTracking } from './hooks/usePageTracking'

function AppRoutes() {
  const location = useLocation()
  const wcRedirect = worldCupOnlyRedirect(location.pathname)
  if (wcRedirect) {
    return <Navigate to={wcRedirect} replace />
  }

  return (
    <RouteErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageLoading label="טוען עמוד..." />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/mvps" element={<MVPs />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/player-zone" element={<PlayerZone />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/girls" element={<GirlsHome />} />
        <Route path="/teams-girls" element={<GirlsTeams />} />
        <Route path="/news-girls" element={<GirlsNews />} />
        <Route path="/archive-girls" element={<GirlsArchive />} />
        {worldCupEnabled && (
          <>
            <Route path="/world-cup" element={<WorldCupDashboard />} />
            <Route path="/world-cup/teams" element={<WorldCupTeams />} />
            <Route path="/world-cup/schedule" element={<WorldCupSchedule />} />
            <Route path="/world-cup/stats" element={<WorldCupStats />} />
          </>
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </RouteErrorBoundary>
  )
}

function AppShell() {
  const { isGirls, isWorldCup } = useTournament()
  const { consent } = useCookieConsent()
  useAnalyticsTracking(consent)
  const mainRef = useRef<HTMLElement>(null)
  const {
    open: drawerOpen,
    setOpen: setDrawerOpen,
    openDrawer,
    isMobile,
    reducedMotion,
  } = useSidebarDrawer()

  const tournamentTheme = isWorldCup ? 'worldcup' : isGirls ? 'girls' : 'boys'

  useSwipeOpenDrawer(mainRef, {
    onOpen: openDrawer,
    disabled: !isMobile || drawerOpen || reducedMotion,
  })

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    const color = isWorldCup ? '#1a3a6e' : isGirls ? '#9b4d72' : '#509238'
    meta.setAttribute('content', color)
  }, [isWorldCup, isGirls])

  return (
    <NavActionIndicatorsProvider>
      <TournamentPreferenceRedirect />
      <div
        className={`app${isMobile ? ' has-mobile-bottom-nav' : ''}`}
        dir="rtl"
        data-tournament={tournamentTheme}
      >
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>
        <div className="header-news-wrapper">
          <div className="container-fluid p-0">
            <header
              className={`tournament-header py-2${isMobile ? ' tournament-header--band' : ' text-center'}`}
            >
              {isMobile ? (
                <div className="tournament-header-band">
                  <div className="tournament-header-band-switcher">
                    {!worldCupOnly && <TournamentSwitcher />}
                  </div>
                  <div className="tournament-header-band-title">
                    <h1 className="site-title fw-bold mb-0">
                      {isWorldCup ? 'מונדיאל 2026' : <>מונדיאל קיץ{'\u00A0'}2026</>}
                    </h1>
                  </div>
                  <div className="tournament-header-band-menu">
                    <button
                      type="button"
                      className="tournament-header-menu-btn"
                      aria-label={drawerOpen ? 'סגור תפריט ניווט' : 'פתח תפריט ניווט'}
                      aria-expanded={drawerOpen}
                      aria-controls="tournament-sidebar-panel"
                      onClick={() => setDrawerOpen(!drawerOpen)}
                    >
                      <span className="tournament-sidebar-handle-bar" aria-hidden="true" />
                      <span className="tournament-sidebar-handle-bar" aria-hidden="true" />
                      <span className="tournament-sidebar-handle-bar" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="site-title fw-bold">
                    {isWorldCup ? 'מונדיאל 2026' : <>מונדיאל קיץ{'\u00A0'}2026</>}
                  </h1>
                  {isGirls && (
                    <p className="tournament-subtitle mb-0">טורניר בנות — נקודות</p>
                  )}
                  {isWorldCup && (
                    <p className="tournament-subtitle mb-0">
                      נתונים מ-{' '}
                      <a
                        href="https://www.football-data.org"
                        className="tournament-subtitle-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        football-data.org
                      </a>
                    </p>
                  )}
                  {!worldCupOnly && <TournamentSwitcher />}
                </>
              )}
            </header>
          </div>
          {!isWorldCup && <NewsBanner />}
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
            />
          </div>
        </div>
        <Footer />
        {isMobile && <MobileBottomNav />}
        <ScrollToTop />
        {consent === 'accepted' && <Analytics />}
      </div>
    </NavActionIndicatorsProvider>
  )
}

function App() {
  return (
    <Router>
      <CookieNotice />
      <AccessibilityToolbar />
      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/rules" element={<TournamentRules />} />
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
