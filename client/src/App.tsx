import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Schedule from './pages/Schedule';
import Stats from './pages/Stats';
import Login from './pages/admin/Login';
import AdminPanel from './pages/admin/AdminPanel';
import Navbar from './components/Navbar';
import NewsBanner from './components/NewsBanner';
import Footer from './components/Footer';
import IftarTimer from './components/IftarTimer';
import AlarmsWidget from './components/AlarmsWidget';
import PlayerZone from './pages/PlayerZone';
import './App.css';
import { Analytics } from '@vercel/analytics/react';
import { useState } from 'react';

function App() {
  const [activeWidget, setActiveWidget] = useState<'none' | 'iftar' | 'alarms'>('none');

  return (
    <Router>
      <div className="app" dir="rtl">
        <IftarTimer
          isActive={activeWidget === 'iftar'}
          onToggle={(active) => setActiveWidget(active ? 'iftar' : 'none')}
        />
        <AlarmsWidget
          isActive={activeWidget === 'alarms'}
          onToggle={(active) => setActiveWidget(active ? 'alarms' : 'none')}
        />
        {/* Header & News Banner Container */}
        <div className="header-news-wrapper">
          <div className="container-fluid p-0">
            <header className="tournament-header text-center py-4">
              <img src="/banner-foreground.svg" className="banner-foreground right" alt="" />
              <img src="/banner-foreground.svg" className="banner-foreground left" alt="" />
              <img src="/to-be-logo.svg" className="header-side-logo left" alt="" />
              <img src="/Flag_of_Adygea.svg" className="header-side-logo right" alt="" />
              <h1 className="display-4 fw-bold">טורניר נצ'מאז<br />1447/2026</h1>
              <p className="lead" id="tournamentPhase">שלב הבתים</p>
            </header>
          </div>

          {/* News Banner */}
          <NewsBanner />
        </div>

        <div className="container-fluid">
          {/* Navigation Tabs */}
          <Navbar />

          {/* Main Content */}
          <div className="tab-content">
            <main className="tab-pane fade show active">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/player-zone" element={<PlayerZone />} />
              </Routes>
            </main>
          </div>
        </div>

        {/* Footer */}
        <Footer />

        <Analytics />
      </div>
    </Router>
  );
}

export default App;
