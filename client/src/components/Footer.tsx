import { Link } from 'react-router-dom';
import { BitDonateLink } from './BitDonateLink';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import { BIT_DONATE_PHONE } from '../config/contactConfig';

const Footer = () => {
    const { user } = useAuth();
    const { isGirls, isWorldCup, paths } = useTournament();
    const isAdmin = user?.role === 'Admin' || user?.role === 'admin';

    const brandTitle = isWorldCup
        ? 'מונדיאל 2026'
        : isGirls
          ? 'טורניר בנות — נקודות'
          : 'טורניר קיץ 2026';

    const tournamentLinks = isWorldCup
        ? [
              { to: paths.home, label: 'דף הבית' },
              { to: 'teams' in paths ? paths.teams : '/world-cup/teams', label: 'נבחרות' },
              { to: 'schedule' in paths ? paths.schedule : '/world-cup/schedule', label: 'לוח משחקים' },
              { to: 'stats' in paths ? paths.stats : '/world-cup/stats', label: 'סטטיסטיקות' },
          ]
        : isGirls
          ? [
                { to: paths.home ?? '/girls', label: 'דף הבית' },
                { to: 'teams' in paths ? paths.teams : '/teams-girls', label: 'קבוצות' },
                ...('news' in paths && paths.news
                  ? [{ to: paths.news, label: 'חדשות' }]
                  : []),
                ...('archive' in paths && paths.archive
                  ? [{ to: paths.archive, label: 'ארכיון' }]
                  : []),
            ]
          : [
                { to: 'mvps' in paths ? paths.mvps : '/mvps', label: 'שחקני העונה' },
                { to: paths.home ?? '/', label: 'דף הבית' },
                { to: 'teams' in paths ? paths.teams : '/teams', label: 'קבוצות' },
                { to: 'schedule' in paths ? paths.schedule : '/schedule', label: 'לוח משחקים' },
                { to: 'stats' in paths ? paths.stats : '/stats', label: 'סטטיסטיקות' },
                { to: 'archive' in paths ? paths.archive : '/archive', label: 'היסטוריית הטורניר' },
            ];

    return (
        <footer className="tournament-footer">
            <div className="container">
                <div className="row py-3 tournament-footer-row">
                    <div className="col-md-4">
                        <h5 className="footer-heading">{brandTitle}</h5>
                        <p className="footer-text">
                            {isWorldCup ? (
                                <>נתוני משחקים מ-football-data.org</>
                            ) : (
                                <>
                                    טורניר קיץ כדורגל בחסות מרכז צעירים
                                    <br />
                                    כפר כמא
                                </>
                            )}
                        </p>
                    </div>

                    <div className="col-md-4">
                        <h5 className="footer-heading">קישורים</h5>
                        <ul className="footer-list">
                            {tournamentLinks.map((link) => (
                                <li key={link.to}>
                                    <Link to={link.to} className="footer-link">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            <li><Link to="/accessibility" className="footer-link">נגישות</Link></li>
                            <li><Link to="/about" className="footer-link">אודות</Link></li>
                            <li><Link to="/privacy" className="footer-link">מדיניות פרטיות</Link></li>
                            <li><Link to="/terms" className="footer-link">תנאי שימוש</Link></li>
                        </ul>
                    </div>

                    <div className="col-md-4">
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

                <div className="footer-bottom">
                    <p className="mb-0">
                        Amir Labai ·{' '}
                        <a href="mailto:amirlabay+WC@gmail.com" className="footer-link">
                            amirlabay+WC@gmail.com
                        </a>
                        {BIT_DONATE_PHONE && (
                            <>
                                {' · '}
                                <BitDonateLink className="footer-link" />
                            </>
                        )}
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
