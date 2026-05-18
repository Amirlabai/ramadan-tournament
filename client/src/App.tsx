import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Schedule from './pages/Schedule';
import Stats from './pages/Stats';
import Login from './pages/admin/Login';
import AdminPanel from './pages/admin/AdminPanel';
import Profile from './pages/Profile';
import MVPs from './pages/MVPs';
import TournamentNavbar from './components/TournamentNavbar';
import TournamentSwitcher from './components/TournamentSwitcher';
import NewsBanner from './components/NewsBanner';
import { TournamentProvider, TournamentPreferenceRedirect } from './contexts/TournamentContext';
import GirlsHome from './pages/girls/GirlsHome';
import GirlsTeams from './pages/girls/GirlsTeams';
import GirlsNews from './pages/girls/GirlsNews';
import GirlsArchive from './pages/girls/GirlsArchive';
import Footer from './components/Footer';
// import IftarTimer from './components/IftarTimer';
import AlarmsWidget from './components/AlarmsWidget';
import ScrollToTop from './components/ScrollToTop';
import PlayerZone from './pages/PlayerZone';
import Archive from './pages/Archive';
import Accessibility from './pages/Accessibility';
import './App.css';
import { Analytics } from '@vercel/analytics/react';
import { useState } from 'react';

function App() {
  const [activeWidget, setActiveWidget] = useState<'none' | 'alarms'>('none');

  return (
    <Router>
      <TournamentProvider>
      <TournamentPreferenceRedirect />
      <div className="app" dir="rtl">
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>
        {/* <IftarTimer
          isActive={activeWidget === 'iftar'}
          onToggle={(active) => setActiveWidget(active ? 'iftar' : 'none')}
        /> */}
        <AlarmsWidget
          isActive={activeWidget === 'alarms'}
          onToggle={(active) => setActiveWidget(active ? 'alarms' : 'none')}
        />
        {/* Header & News Banner Container */}
        <div className="header-news-wrapper">
          <div className="container-fluid p-0">
            <header className="tournament-header text-center py-4">
              <img src="/to-be-logo.svg" className="header-side-logo left" alt="לוגו טורניר נצ'מאז" />
              <img src="/Flag_of_Adygea.svg" className="header-side-logo right" alt="דגל אדיגיה" />
              <h1 className="display-4 fw-bold">טורניר קיץ<br />2026</h1>
              <TournamentSwitcher />
            </header>
          </div>

          {/* News Banner */}
          <NewsBanner />
        </div>

        <div className="container-fluid">
          {/* Navigation Tabs */}
          <TournamentNavbar />

          {/* Main Content */}
          <main id="main-content" tabIndex={-1}>
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
              <Route path="/accessibility" element={<Accessibility />} />
            </Routes>
          </main>
        </div>

        {/* Footer */}
        <Footer />

        <ScrollToTop />

        <Analytics />
      </div>
      </TournamentProvider>
    </Router>
  );
}

export default App;
