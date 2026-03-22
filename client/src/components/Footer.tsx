import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Footer = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

    return (
        <footer className="tournament-footer">
            <div className="container">
                <div className="row py-4">
                    {/* Tournament Info */}
                    <div className="col-md-4 mb-3">
                        <h5 className="footer-heading">טורניר קיץ 2026</h5>
                        <p className="footer-text">
                            טורניר קיץ כדורגל בחסות מרכז צעירים<br />
                            כפר כמא
                        </p>
                    </div>

                    {/* Links */}
                    <div className="col-md-4 mb-3">
                        <h5 className="footer-heading">קישורים</h5>
                        <ul className="footer-list">
                            <li><Link to="/mvps" className="footer-link">שחקני העונה</Link></li>
                            <li><Link to="/" className="footer-link">דף הבית</Link></li>
                            <li><Link to="/teams" className="footer-link">קבוצות</Link></li>
                            <li><Link to="/schedule" className="footer-link">לוח משחקים</Link></li>
                            <li><Link to="/stats" className="footer-link">סטטיסטיקות</Link></li>
                            <li><Link to="/archive" className="footer-link">היסטוריית הטורניר</Link></li>
                        </ul>
                    </div>

                    {/* Administration/Personal Links */}
                    <div className="col-md-4 mb-3">
                        <h5 className="footer-heading">ניהול ומשתנים</h5>
                        <ul className="footer-list">
                            {user ? (
                                <>
                                    <li><Link to="/profile" className="footer-link">פרופיל אישי</Link></li>
                                    {isAdmin && <li><Link to="/admin" className="footer-link">פאנל ניהול</Link></li>}
                                </>
                            ) : (
                                <li><Link to="/login" className="footer-link">התחברות</Link></li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="footer-bottom">
                    <p className="mb-0">
                        Amir Labai
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
