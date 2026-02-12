import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Schedule from './pages/Schedule';
import Stats from './pages/Stats';
import Login from './pages/admin/Login';
import AdminPanel from './pages/admin/AdminPanel';
import Navbar from './components/Navbar';
import NewsBanner from './components/NewsBanner';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app" dir="rtl">
        {/* Header */}
        <div className="container-fluid p-0">
          <header className="tournament-header text-center py-4">
            <h1 className="display-4 fw-bold">טורניר נצ'מאז<br />1447/2026</h1>
            <p className="lead" id="tournamentPhase">שלב הבתים</p>
          </header>
        </div>

        {/* News Banner */}
        <NewsBanner />

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
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
