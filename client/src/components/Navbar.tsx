import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <ul className="nav nav-tabs tournament-tabs justify-content-center" id="mainTabs" role="tablist">
            <li className="nav-item" role="presentation">
                <Link
                    to="/"
                    className={`nav-link ${isActive('/') ? 'active' : ''}`}
                    role="tab"
                >
                    דף הבית
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link
                    to="/teams"
                    className={`nav-link ${isActive('/teams') ? 'active' : ''}`}
                    role="tab"
                >
                    קבוצות
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link
                    to="/schedule"
                    className={`nav-link ${isActive('/schedule') ? 'active' : ''}`}
                    role="tab"
                >
                    משחקים
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link
                    to="/stats"
                    className={`nav-link ${isActive('/stats') ? 'active' : ''}`}
                    role="tab"
                >
                    סטטיסטיקות
                </Link>
            </li>
            <li className="nav-item" role="presentation">
                <Link
                    to="/admin"
                    className={`nav-link ${isActive('/admin') || isActive('/admin/login') ? 'active' : ''}`}
                    role="tab"
                >
                    ניהול
                </Link>
            </li>
        </ul>
    );
};

export default Navbar;
