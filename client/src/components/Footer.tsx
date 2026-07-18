import { Link } from 'react-router-dom';
import { BitDonateLink } from './BitDonateLink';
import { PRIVACY_CONTACT_EMAIL, SITE_OPERATOR_NAME } from '../config/contactConfig';
import { useAuth } from '../contexts/AuthContext';
import { useTournament } from '../contexts/TournamentContext';
import { canAccessAdminPanel } from '../utils/tournamentUser';
import { showBoysTournamentRulesNav } from '../utils/tournamentRulesNav';
import { useNavActionIndicators } from '../contexts/NavActionIndicatorsContext';
import { NavActionLink } from './NavActionDot';

const Footer = () => {
    const { user } = useAuth();
    const { isGirls, isWorldCup, paths } = useTournament();
    const { profileActionRequired, adminActionRequired } = useNavActionIndicators();
    const showAdminNav = canAccessAdminPanel(user);

    const brandTitle = isWorldCup
        ? 'מונדיאל 2026'
        : isGirls
          ? 'טורניר בנות — נקודות'
          : 'מונדיאל קיץ 2026';

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
                    <div className="col-md-6 col-lg-3">
                        <h5 className="footer-heading">{brandTitle}</h5>
                        <p className="footer-text">
                            {isWorldCup ? (
                                <>נתוני משחקים מ-football-data.org</>
                            ) : (
                                <>
                                    מונדיאל קיץ — טורניר כדורגל בכפר כמא (כפר קמא)
                                    <br />
                                    בחסות מרכז צעירים ומחלקת נוער
                                </>
                            )}
                        </p>
                    </div>

                    <div className="col-md-6 col-lg-3 footer-nav-tournament">
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
                            {!showBoysTournamentRulesNav(isGirls, isWorldCup) ? null : (
                              <li><Link to="/rules" className="footer-link">תקנון הטורניר</Link></li>
                            )}
                            <li><Link to="/privacy" className="footer-link">מדיניות פרטיות</Link></li>
                            <li><Link to="/terms" className="footer-link">תנאי שימוש</Link></li>
                        </ul>
                    </div>

                    <div className="col-md-6 col-lg-3">
                        <h5 className="footer-heading">ניהול ומשתנים</h5>
                        <ul className="footer-list">
                            {user ? (
                                <>
                                    <li>
                                        <NavActionLink
                                            to="/profile"
                                            label="פרופיל אישי"
                                            showActionDot={profileActionRequired}
                                        />
                                    </li>
                                    {showAdminNav && (
                                        <li>
                                            <NavActionLink
                                                to="/admin"
                                                label="פאנל ניהול"
                                                showActionDot={adminActionRequired}
                                            />
                                        </li>
                                    )}
                                </>
                            ) : (
                                <li><Link to="/login" className="footer-link">התחברות</Link></li>
                            )}
                        </ul>
                    </div>

                    <div className="col-md-6 col-lg-3">
                        <h5 className="footer-heading">יצירת קשר</h5>
                        <ul className="footer-list">
                            <li>
                                <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="footer-link">
                                    {PRIVACY_CONTACT_EMAIL}
                                </a>
                            </li>
                            <li>
                                <BitDonateLink className="footer-link" />
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p className="mb-0">{SITE_OPERATOR_NAME}</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
