import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import './Navbar.css';

const NavLink = ({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`nav-link ${active ? 'active' : ''} ${className}`.trim()}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
};

const TournamentNavbar = () => {
  const { user } = useAuth();
  const { paths, isGirls } = useTournament();
  const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

  return (
    <nav aria-label="ניווט ראשי">
      <ul className="nav nav-tabs tournament-tabs justify-content-center" id="mainTabs">
        {isGirls ? (
          <>
            <li className="nav-item">
              <NavLink to={paths.home}>דף הבית</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to={'teams' in paths ? paths.teams : '/teams-girls'}>קבוצות</NavLink>
            </li>
            {'news' in paths && (
              <li className="nav-item">
                <NavLink to={paths.news}>חדשות</NavLink>
              </li>
            )}
            {'archive' in paths && (
              <li className="nav-item">
                <NavLink to={paths.archive}>ארכיון</NavLink>
              </li>
            )}
          </>
        ) : (
          <>
            <li className="nav-item">
              <NavLink to={'mvps' in paths ? paths.mvps : '/mvps'}>MVPs</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to={paths.home}>דף הבית</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to={'teams' in paths ? paths.teams : '/teams'}>קבוצות</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to={'schedule' in paths ? paths.schedule : '/schedule'}>משחקים</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to={'stats' in paths ? paths.stats : '/stats'}>סטטיסטיקות</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to={'archive' in paths ? paths.archive : '/archive'}>ארכיון</NavLink>
            </li>
          </>
        )}

        <li className="nav-item">
          <NavLink to="/accessibility">נגישות</NavLink>
        </li>

        {user ? (
          <li className="nav-item">
            <NavLink to="/profile" className="login-link">
              {user.displayName}
            </NavLink>
          </li>
        ) : (
          <li className="nav-item">
            <NavLink to="/login" className="login-link">
              התחברות
            </NavLink>
          </li>
        )}

        {isAdmin && (
          <li className="nav-item">
            <NavLink to="/admin">ניהול</NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default TournamentNavbar;
