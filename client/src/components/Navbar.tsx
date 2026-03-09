import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
    const location = useLocation();
    const { user } = useAuth();
    const isActive = (...paths: string[]) => paths.includes(location.pathname);
    const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

    return (
        <ul className="nav nav-tabs tournament-tabs justify-content-center" id="mainTabs" role="tablist">
            <li className="nav-item" role="presentation">
                <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`} role="tab">
                    דף הבית
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link to="/teams" className={`nav-link ${isActive('/teams') ? 'active' : ''}`} role="tab">
                    קבוצות
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link to="/schedule" className={`nav-link ${isActive('/schedule') ? 'active' : ''}`} role="tab">
                    משחקים
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link to="/stats" className={`nav-link ${isActive('/stats') ? 'active' : ''}`} role="tab">
                    סטטיסטיקות
                </Link>
            </li>

            {/* Personal profile for all authenticated users */}
            {user ? (
                <li className="nav-item" role="presentation">
                    <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`} role="tab">
                        {user.displayName}
                    </Link>
                </li>
            ) : (
                <li className="nav-item" role="presentation">
                    <Link to="/login" className={`nav-link ${isActive('/login') ? 'active' : ''}`} role="tab">
                        התחברות
                    </Link>
                </li>
            )}

            {/* Admin tab — only for Admins */}
            {isAdmin && (
                <li className="nav-item" role="presentation">
                    <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`} role="tab">
                        ניהול
                    </Link>
                </li>
            )}
        </ul>
    );
};

export default Navbar;
