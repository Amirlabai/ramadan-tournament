import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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

const Navbar = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

    return (
        <nav aria-label="ניווט ראשי">
            <ul className="nav nav-tabs tournament-tabs justify-content-center" id="mainTabs">
                <li className="nav-item">
                    <NavLink to="/mvps">MVPs</NavLink>
                </li>
                <li className="nav-item">
                    <NavLink to="/">דף הבית</NavLink>
                </li>
                <li className="nav-item">
                    <NavLink to="/teams">קבוצות</NavLink>
                </li>
                <li className="nav-item">
                    <NavLink to="/schedule">משחקים</NavLink>
                </li>
                <li className="nav-item">
                    <NavLink to="/stats">סטטיסטיקות</NavLink>
                </li>
                <li className="nav-item">
                    <NavLink to="/accessibility">נגישות</NavLink>
                </li>

                {user ? (
                    <li className="nav-item">
                        <NavLink to="/profile" className="login-link">{user.displayName}</NavLink>
                    </li>
                ) : (
                    <li className="nav-item">
                        <NavLink to="/login" className="login-link">התחברות</NavLink>
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

export default Navbar;
