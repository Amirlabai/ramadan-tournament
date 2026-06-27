import { useEffect, useState } from 'react';
import SEO from '../../components/SEO';
import { useNavigate } from 'react-router-dom';
import { matchesAPI, newsAPI, teamsAPI, adminAPI, type TournamentSlug } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { Match, News, Team } from '../../types';
import MatchTableRow from '../../components/admin/MatchTableRow';
import NewsForm from '../../components/admin/NewsForm';
import RosterManager from '../../components/admin/RosterManager';
import GirlsSeasonAdmin from '../../components/admin/GirlsSeasonAdmin';
import PageLoading from '../../components/PageLoading';
import EmptyState from '../../components/EmptyState';
import { entityId } from '../../utils/entityId';
import { canAccessAdminPanel, isPlatformAdmin } from '../../utils/tournamentUser';
import './AdminPanel.css';

const AdminPanel = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [news, setNews] = useState<News[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    type TabType = 'matches' | 'news' | 'banned-words' | 'comments' | 'roster' | 'users' | 'girls';
    const { user, loading: authLoading, logout } = useAuth();

    const platformAdmin = isPlatformAdmin(user);

    const [activeTab, setActiveTab] = useState<TabType>('matches');
    const [newsDivision, setNewsDivision] = useState<TournamentSlug>('boys');
    const [bannedWords, setBannedWords] = useState<any[]>([]);
    const [newWord, setNewWord] = useState('');
    const [newWordLanguage, setNewWordLanguage] = useState('other');
    const [comments, setComments] = useState<any[]>([]);
    const [matchFilter, setMatchFilter] = useState<'all' | 'upcoming' | 'live' | 'finished' | 'today'>('all');
    const [automationLoading, setAutomationLoading] = useState(false);
    const [playoffSyncLoading, setPlayoffSyncLoading] = useState(false);

    const [searchFilter, setSearchFilter] = useState('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<
        { id: string; displayName: string; email?: string | null; username?: string | null; role: string }[]
    >([]);
    const [userSearchLoading, setUserSearchLoading] = useState(false);
    const [userRoleMsg, setUserRoleMsg] = useState('');
    const [userRoleActingId, setUserRoleActingId] = useState<string | null>(null);
    const [userSearchSubmitted, setUserSearchSubmitted] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            navigate('/admin/login');
            return;
        }

        const allowed = canAccessAdminPanel(user);
        if (!allowed) {
            navigate('/profile');
            return;
        }

        const isAdmin = isPlatformAdmin(user);

        const fetchData = async () => {
            try {
                if (isAdmin) {
                    const [matchesRes, teamsRes] = await Promise.all([
                        matchesAPI.getAll(),
                        teamsAPI.getAll(),
                    ]);
                    const matchesSorted = matchesRes.data.sort(
                        (a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                    setMatches(matchesSorted);
                    setTeams(teamsRes.data);

                    await Promise.all([
                        adminAPI.getBannedWords()
                            .then((res) => setBannedWords(res.data))
                            .catch((err) => console.error('Error fetching banned words:', err)),
                        adminAPI.getComments()
                            .then((res) => setComments(res.data))
                            .catch((err) => console.error('Error fetching comments:', err)),
                    ]);
                }
            } catch (err) {
                console.error(err);
                navigate('/admin/login');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authLoading, user, navigate]);

    useEffect(() => {
        if (activeTab === 'banned-words') {
            fetchBannedWords();
        } else if (activeTab === 'comments') {
            fetchComments();
        }
    }, [activeTab]);

    useEffect(() => {
        if (!user || !isPlatformAdmin(user)) return;

        let cancelled = false;
        newsAPI.getAll(newsDivision)
            .then((res) => {
                if (!cancelled) setNews(res.data);
            })
            .catch((err) => console.error('Error fetching news:', err));

        return () => {
            cancelled = true;
        };
    }, [newsDivision, user]);

    useEffect(() => {
        if (activeTab !== 'news') return;
        if (!user || !isPlatformAdmin(user)) return;

        let cancelled = false;
        newsAPI.getAll(newsDivision)
            .then((res) => {
                if (!cancelled) setNews(res.data);
            })
            .catch((err) => console.error('Error fetching news:', err));

        return () => {
            cancelled = true;
        };
    }, [activeTab, newsDivision, user]);

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const deleteMatch = async (id: number) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק משחק זה?')) return;
        try {
            await matchesAPI.delete(id);
            setMatches(matches.filter(m => m.id !== id));
        } catch (err) {
            alert('שגיאה במחיקת משחק');
        }
    };

    const deleteNews = async (id: number) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק חדשה זו?')) return;
        try {
            await newsAPI.delete(id, newsDivision);
            setNews(news.filter(n => n.id !== id));
        } catch (err) {
            alert('שגיאה במחיקת חדשה');
        }
    };

    const [editingNews, setEditingNews] = useState<News | null>(null);
    const [showNewsForm, setShowNewsForm] = useState(false);
    const [addingNewMatch, setAddingNewMatch] = useState(false);

    const handleSaveMatch = async (id: number, data: any) => {
        try {
            if (id === -1) {
                // New match
                const res = await matchesAPI.create(data);
                setMatches(prev => [...prev, res.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                setAddingNewMatch(false);
            } else {
                await matchesAPI.update(id, data);
                setMatches(prev =>
                    prev.map(m => m.id === id ? { ...m, ...data } : m)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                );
            }
        } catch (err) {
            alert('שגיאה בשמירת משחק');
            console.error(err);
            throw err; // re-throw so MatchTableRow can keep edit mode
        }
    };

    const handleSaveNews = async (data: any) => {
        try {
            if (editingNews) {
                await newsAPI.update(editingNews.id, data, newsDivision);
                setNews(news.map(n => n.id === editingNews.id ? { ...n, ...data } : n));
            } else {
                const res = await newsAPI.create(data, newsDivision);
                setNews([res.data, ...news].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
            setShowNewsForm(false);
            setEditingNews(null);
        } catch (err) {
            alert('שגיאה בשמירת חדשות');
            console.error(err);
        }
    };

    const startEditNews = (item: News) => {
        setEditingNews(item);
        setShowNewsForm(true);
    };

    const getTeamName = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `קבוצה ${teamId}`;
    };

    const getMatchStatus = (match: Match) => {
        if (match.score1 != null && match.score2 != null) return 'finished';
        const matchDate = new Date(match.date);
        const now = new Date();

        // Jerusalem time comparison
        const isToday = matchDate.getDate() === now.getDate() &&
            matchDate.getMonth() === now.getMonth() &&
            matchDate.getFullYear() === now.getFullYear();

        if (isToday) {
            // Live if it's 20:00 or later (JLM time - simplified for admin)
            const currentHour = now.getHours();
            return currentHour >= 20 ? 'live' : 'upcoming';
        }

        return matchDate < now ? 'finished' : 'upcoming';
    };

    const filteredAdminMatches = matches.filter((match) => {
        if (matchFilter === 'all') return true;
        if (matchFilter === 'today') {
            const d = new Date(match.date);
            const now = new Date();
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return getMatchStatus(match) === matchFilter;
    });

    const fetchBannedWords = async () => {
        try {
            const response = await adminAPI.getBannedWords();
            setBannedWords(response.data);
        } catch (err) {
            console.error('Error fetching banned words:', err);
        }
    };

    const handleAddBannedWord = async () => {
        if (!newWord.trim()) return;

        // Check for duplicates on client side
        const wordLower = newWord.trim().toLowerCase();
        if (bannedWords.some(w => w.word.toLowerCase() === wordLower)) {
            alert('המילה כבר קיימת ברשימה');
            return;
        }

        try {
            const response = await adminAPI.addBannedWord({
                word: newWord.trim(),
                language: newWordLanguage,
            });
            setBannedWords([...bannedWords, response.data]);
            setNewWord('');
            setNewWordLanguage('other');
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בהוספת מילה');
        }
    };

    const handleRemoveBannedWord = async (id: string) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק מילה זו?')) return;

        try {
            await adminAPI.removeBannedWord(id);
            setBannedWords(bannedWords.filter(w => entityId(w) !== id));
        } catch (err) {
            alert('שגיאה במחיקת מילה');
        }
    };

    const fetchComments = async () => {
        try {
            const response = await adminAPI.getComments();
            setComments(response.data);
        } catch (err) {
            console.error('Error fetching comments:', err);
        }
    };

    const handleDeleteComment = async (id: string) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק תגובה זו?')) return;

        try {
            await adminAPI.deleteComment(id);
            setComments(comments.filter(c => entityId(c) !== id));
        } catch (err) {
            alert('שגיאה במחיקת תגובה');
        }
    };

    const handleUserSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = userSearchQuery.trim();
        if (q.length < 2) {
            setUserRoleMsg('הקלד לפחות שני תווים לחיפוש');
            return;
        }
        setUserSearchLoading(true);
        setUserRoleMsg('');
        setUserSearchSubmitted(true);
        try {
            const res = await adminAPI.searchUsers(q);
            setUserSearchResults(Array.isArray(res.data) ? res.data : []);
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setUserRoleMsg(ax.response?.data?.error || 'שגיאה בחיפוש');
            setUserSearchResults([]);
        } finally {
            setUserSearchLoading(false);
        }
    };

    const handleSetUserRole = async (userId: string, role: 'admin' | 'user') => {
        if (role === 'admin' && !confirm('להעניק הרשאת מנהל למשתמש זה?')) return;
        if (role === 'user' && !confirm('להסיר הרשאת מנהל ממשתמש זה?')) return;
        setUserRoleActingId(userId);
        setUserRoleMsg('');
        try {
            const res = await adminAPI.setUserRole(userId, role);
            setUserRoleMsg(res.data?.message || 'תפקיד עודכן');
            setUserSearchResults((rows) =>
                rows.map((row) => (row.id === userId ? { ...row, role } : row))
            );
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            setUserRoleMsg(ax.response?.data?.error || 'שגיאה בעדכון תפקיד');
        } finally {
            setUserRoleActingId(null);
        }
    };

    const handleTriggerAutomation = async () => {
        setAutomationLoading(true);
        try {
            const res = await adminAPI.triggerNewsAutomation();
            if (res.data.status === 'posted') {
                alert(`עדכון בוצע בהצלחה!\n\n${res.data.message}`);
                // Refresh news feed
                const newsRes = await newsAPI.getAll(newsDivision);
                setNews(newsRes.data);
            } else if (res.data.status === 'no_changes') {
                alert('לא נמצאו שינויים המצדיקים עדכון חדשות.');
            } else {
                alert(`שגיאה: ${res.data.message}`);
            }
        } catch (err: any) {
            console.error('Automation error:', err);
            alert('נכשל בהפעלת האוטומציה: ' + (err.response?.data?.message || err.message));
        } finally {
            setAutomationLoading(false);
        }
    };





    const handleSyncPlayoffs = async () => {
        if (!confirm('פעולה זו תעדכן את משחקי הפלייאוף לפי הטבלה הנוכחית. להמשיך?')) return;
        setPlayoffSyncLoading(true);
        try {
            await matchesAPI.syncPlayoffs();
            alert('משחקי הפלייאוף סונכרנו בהצלחה!');
            const matchesRes = await matchesAPI.getAll();
            const matchesSorted = matchesRes.data.sort((a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setMatches(matchesSorted);
        } catch (err: any) {
            console.error('Playoff sync error:', err);
            alert('שגיאה בסנכרון פלייאוף: ' + (err.response?.data?.error || err.message));
        } finally {
            setPlayoffSyncLoading(false);
        }
    };

    if (loading) return <PageLoading label="טוען פאנל ניהול..." />;

    return (
        <div className="admin-panel">
            <SEO
                title="פאנל ניהול"
                description="ניהול משחקים, חדשות, שחקנים ותגובות — טורניר קיץ 2026."
                pathname="/admin"
                noindex
            />
            <div className="admin-header">
                <h2>פאנל ניהול</h2>
                <button type="button" onClick={handleLogout} className="btn btn-danger">
                    התנתק
                </button>
            </div>

            <div className="tabs" role="tablist" aria-label="לשוניות ניהול">
                {platformAdmin && (
                    <>
                        <button
                            type="button"
                            role="tab"
                            id="admin-tab-matches"
                            aria-controls="admin-panel-matches"
                            aria-selected={activeTab === 'matches'}
                            className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
                            onClick={() => setActiveTab('matches')}
                        >
                            ניהול משחקים ({matches.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="admin-tab-news"
                            aria-controls="admin-panel-news"
                            aria-selected={activeTab === 'news'}
                            className={`tab ${activeTab === 'news' ? 'active' : ''}`}
                            onClick={() => setActiveTab('news')}
                        >
                            ניהול חדשות ({news.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="admin-tab-banned-words"
                            aria-controls="admin-panel-banned-words"
                            aria-selected={activeTab === 'banned-words'}
                            className={`tab ${activeTab === 'banned-words' ? 'active' : ''}`}
                            onClick={() => setActiveTab('banned-words')}
                        >
                            מילים חסומות ({bannedWords.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="admin-tab-comments"
                            aria-controls="admin-panel-comments"
                            aria-selected={activeTab === 'comments'}
                            className={`tab ${activeTab === 'comments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('comments')}
                        >
                            ניהול תגובות ({comments.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="admin-tab-users"
                            aria-controls="admin-panel-users"
                            aria-selected={activeTab === 'users'}
                            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            משתמשים
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="admin-tab-girls"
                            aria-controls="admin-panel-girls"
                            aria-selected={activeTab === 'girls'}
                            className={`tab ${activeTab === 'girls' ? 'active' : ''}`}
                            onClick={() => setActiveTab('girls')}
                        >
                            טורניר בנות (נקודות)
                        </button>
                    </>
                )}
                {platformAdmin && (
                    <button
                        type="button"
                        role="tab"
                        id="admin-tab-roster"
                        aria-controls="admin-panel-roster"
                        aria-selected={activeTab === 'roster'}
                        className={`tab ${activeTab === 'roster' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roster')}
                    >
                        סגל ורישום
                    </button>
                )}
            </div>

            {platformAdmin && activeTab === 'matches' && (
                <div role="tabpanel" id="admin-panel-matches" aria-labelledby="admin-tab-matches" className="tab-content" tabIndex={0}>
                    <div className="admin-filters mb-3">
                        <button
                            type="button"
                            className={`filter-btn ${matchFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setMatchFilter('all')}
                        >
                            הכל
                        </button>
                        <button
                            type="button"
                            className={`filter-btn ${matchFilter === 'today' ? 'active' : ''}`}
                            onClick={() => setMatchFilter('today')}
                        >
                            היום
                            <span className="filter-count">
                                {matches.filter(m => {
                                    const d = new Date(m.date);
                                    const now = new Date();
                                    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                }).length}
                            </span>
                        </button>
                    </div>

                    <div className="card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2>משחקים</h2>
                            <div className="d-flex gap-2">
                                <button 
                                    className="btn btn-outline-info" 
                                    onClick={handleSyncPlayoffs}
                                    disabled={playoffSyncLoading}
                                >
                                    {playoffSyncLoading ? 'מעבד...' : '🔄 סנכרן פלייאוף'}
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setAddingNewMatch(true)}
                                    disabled={addingNewMatch}
                                >
                                    + הוסף משחק חדש
                                </button>
                            </div>
                        </div>

                        <div className="matches-table-wrapper">
                            <table className="matches-table">
                                <thead>
                                    <tr>
                                        <th>תאריך ושעה</th>
                                        <th>מיקום</th>
                                        <th>שלב</th>
                                        <th>קבוצה 1</th>
                                        <th>תוצאה</th>
                                        <th>קבוצה 2</th>
                                        <th>כובשים</th>
                                        <th>פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {addingNewMatch && (
                                        <MatchTableRow
                                            key="new-match"
                                            match={{
                                                id: -1,
                                                team1Id: teams[0]?.id ?? 1,
                                                team2Id: teams[1]?.id ?? 2,
                                                score1: undefined,
                                                score2: undefined,
                                                date: new Date().toISOString(),
                                                location: '',
                                                phase: 'group',
                                                goals: [],
                                            } as any}
                                            teams={teams}
                                            onSave={handleSaveMatch}
                                            onDelete={() => setAddingNewMatch(false)}
                                            startInEditMode
                                        />
                                    )}
                                    {!addingNewMatch && filteredAdminMatches.length === 0 && (
                                        <tr>
                                            <td colSpan={8}>
                                                <EmptyState
                                                    title="אין משחקים להצגה"
                                                    message={
                                                        matches.length === 0
                                                            ? 'אין משחקים במערכת. הוסף משחק ידנית או הפעל את מחולל לוח המשחקים מהשרת.'
                                                            : 'אין משחקים בסינון שנבחר.'
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    )}
                                    {filteredAdminMatches.map((match, index) => (
                                            <MatchTableRow
                                                key={match.id}
                                                match={match}
                                                index={index}
                                                teams={teams}
                                                onSave={handleSaveMatch}
                                                onDelete={deleteMatch}
                                            />
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {platformAdmin && activeTab === 'news' && (
                <div role="tabpanel" id="admin-panel-news" aria-labelledby="admin-tab-news" className="tab-content" tabIndex={0}>
                    {!showNewsForm ? (
                        <div className="card">
                            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <h2 className="mb-0">חדשות</h2>
                                    <label className="visually-hidden" htmlFor="news-division-select">חטיבה</label>
                                    <select
                                        id="news-division-select"
                                        className="form-select form-select-sm w-auto"
                                        value={newsDivision}
                                        onChange={(e) => setNewsDivision(e.target.value as TournamentSlug)}
                                    >
                                        <option value="boys">טורניר בנים</option>
                                        <option value="girls">טורניר בנות</option>
                                    </select>
                                </div>
                                <div className="d-flex gap-2">
                                    <button 
                                        className="btn btn-outline-success" 
                                        onClick={handleTriggerAutomation}
                                        disabled={automationLoading}
                                    >
                                        {automationLoading ? 'מעבד...' : '⚡ צור עדכון יומי (AI)'}
                                    </button>
                                    <button className="btn btn-primary" onClick={() => { setEditingNews(null); setShowNewsForm(true); }}>
                                        + הוסף חדשה
                                    </button>
                                </div>
                            </div>
                            <div className="items-list">
                                {news.map(item => (
                                    <div key={item.id} className="item">
                                        <div className="item-info">
                                            <strong>{item.title}</strong>
                                            <span>{item.message}</span>
                                            <span className={`priority ${item.priority}`}>
                                                {item.priority === 'high' ? 'עדיפות גבוהה' : 'רגיל'}
                                            </span>
                                        </div>
                                        <div className="item-actions">
                                            <button onClick={() => startEditNews(item)} className="btn btn-warning ms-2">ערוך</button>
                                            <button onClick={() => deleteNews(item.id)} className="btn btn-danger">מחק</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <NewsForm
                            initialData={editingNews}
                            onSubmit={handleSaveNews}
                            onCancel={() => { setShowNewsForm(false); setEditingNews(null); }}
                        />
                    )}
                </div>
            )}

            {platformAdmin && activeTab === 'banned-words' && (
                <div role="tabpanel" id="admin-panel-banned-words" aria-labelledby="admin-tab-banned-words" className="tab-content" tabIndex={0}>
                    <div className="card">
                        <h2>ניהול מילים חסומות</h2>

                        <div className="p-4">
                            <div className="mb-4">
                                <h3>הוסף מילה חדשה</h3>
                                <div className="d-flex gap-2">
                                    <label htmlFor="new-banned-word" className="visually-hidden">מילה חדשה</label>
                                    <input
                                        type="text"
                                        id="new-banned-word"
                                        className="form-control"
                                        aria-label="מילה חדשה לחסימה"
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddBannedWord()}
                                    />
                                    <select
                                        className="form-control"
                                        value={newWordLanguage}
                                        onChange={(e) => setNewWordLanguage(e.target.value)}
                                        style={{ maxWidth: '150px' }}
                                    >
                                        <option value="en">English</option>
                                        <option value="he">עברית</option>
                                        <option value="other">אחר</option>
                                    </select>
                                    <button
                                        onClick={handleAddBannedWord}
                                        className="btn btn-primary"
                                        disabled={!newWord.trim()}
                                    >
                                        הוסף
                                    </button>
                                </div>
                            </div>

                            <div className="items-list">
                                {bannedWords.length === 0 ? (
                                    <div className="text-center text-muted p-4">אין מילים חסומות</div>
                                ) : (
                                    bannedWords.map((word) => {
                                        const wordId = entityId(word);
                                        return (
                                        <div key={wordId} className="item">
                                            <div className="item-info">
                                                <strong>{word.word}</strong>
                                                <span className="badge" style={{
                                                    background: word.language === 'en' ? '#3b82f6' :
                                                        word.language === 'he' ? '#10b981' : '#6b7280',
                                                    color: 'white',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {word.language === 'en' ? 'English' :
                                                        word.language === 'he' ? 'עברית' : 'אחר'}
                                                </span>
                                            </div>
                                            <div className="item-actions">
                                                <button
                                                    onClick={() => handleRemoveBannedWord(wordId)}
                                                    className="btn btn-danger"
                                                >
                                                    מחק
                                                </button>
                                            </div>
                                        </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {platformAdmin && activeTab === 'comments' && (
                <div role="tabpanel" id="admin-panel-comments" aria-labelledby="admin-tab-comments" className="tab-content" tabIndex={0}>
                    <div className="card">
                        <h2>ניהול תגובות</h2>

                        <div className="p-4">
                            <div className="mb-4">
                                <label htmlFor="comment-search" className="form-label">חיפוש תגובות</label>
                                <input
                                    type="text"
                                    id="comment-search"
                                    className="form-control"
                                    aria-label="חפש תגובות"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                />
                            </div>

                            <div className="items-list">
                                {comments.length === 0 ? (
                                    <div className="text-center text-muted p-4">אין תגובות</div>
                                ) : (
                                    comments
                                        .filter(comment =>
                                            !searchFilter ||
                                            comment.content.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                            comment.author.toLowerCase().includes(searchFilter.toLowerCase())
                                        )
                                        .map((comment) => {
                                            const match = matches.find(m => m.id === comment.matchId);
                                            const commentId = entityId(comment);
                                            return (
                                                <div key={commentId} className="item">
                                                    <div className="item-info" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', width: '100%' }}>
                                                            <strong>{comment.author}</strong>
                                                            <span style={{ color: '#666', fontSize: '0.85rem' }}>
                                                                {new Date(comment.createdAt).toLocaleString('he-IL')}
                                                            </span>
                                                        </div>
                                                        {match && (
                                                            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                                                                משחק: {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
                                                            </div>
                                                        )}
                                                        <div style={{ marginTop: '0.5rem' }}>{comment.content}</div>
                                                    </div>
                                                    <div className="item-actions">
                                                        <button
                                                            onClick={() => handleDeleteComment(commentId)}
                                                            className="btn btn-danger"
                                                        >
                                                            מחק
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {platformAdmin && activeTab === 'roster' && (
                <div role="tabpanel" id="admin-panel-roster" aria-labelledby="admin-tab-roster" className="tab-content" tabIndex={0}>
                    <div className="card p-3">
                        <RosterManager />
                    </div>
                </div>
            )}

            {platformAdmin && activeTab === 'users' && (
                <div role="tabpanel" id="admin-panel-users" aria-labelledby="admin-tab-users" className="tab-content" tabIndex={0}>
                    <div className="card p-4">
                        <h3 className="h5 mb-3">ניהול הרשאות מנהל</h3>
                        <p className="text-muted small mb-3">
                            חפש משתמש לפי שם, אימייל או שם משתמש. לאחר שינוי תפקיד, המשתמש צריך להתחבר מחדש.
                        </p>
                        <form onSubmit={(e) => void handleUserSearch(e)} className="mb-4">
                            <label htmlFor="admin-user-search" className="form-label">
                                חיפוש משתמש
                            </label>
                            <div className="input-group">
                                <input
                                    id="admin-user-search"
                                    type="search"
                                    className="form-control"
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    minLength={2}
                                    autoComplete="off"
                                />
                                <button type="submit" className="btn btn-primary" disabled={userSearchLoading}>
                                    {userSearchLoading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                                            מחפש…
                                        </>
                                    ) : (
                                        'חפש'
                                    )}
                                </button>
                            </div>
                        </form>

                        {userSearchLoading && (
                            <PageLoading label="מחפש משתמשים..." />
                        )}

                        {!userSearchLoading && userSearchSubmitted && userSearchResults.length === 0 && !userRoleMsg && (
                            <EmptyState message="לא נמצאו משתמשים לחיפוש זה." />
                        )}

                        {!userSearchLoading && !userSearchSubmitted && (
                            <p className="text-muted small mb-0">הקלד לפחות שני תווים ולחץ חפש.</p>
                        )}

                        {userRoleMsg && (
                            <p className="small text-muted mb-3" role="status">
                                {userRoleMsg}
                            </p>
                        )}

                        {userSearchResults.length > 0 && !userSearchLoading && (
                            <ul className="list-unstyled mb-0">
                                {userSearchResults.map((row) => (
                                    <li
                                        key={row.id}
                                        className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-3 border-bottom"
                                    >
                                        <div>
                                            <strong>{row.displayName}</strong>
                                            {row.email && (
                                                <span className="text-muted small ms-2" dir="ltr">
                                                    {row.email}
                                                </span>
                                            )}
                                            <div className="small text-muted">
                                                תפקיד: {row.role === 'admin' ? 'מנהל' : 'משתמש'}
                                            </div>
                                        </div>
                                        <span className="d-flex gap-1">
                                            {row.role !== 'admin' && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-success"
                                                    disabled={userRoleActingId === row.id}
                                                    onClick={() => void handleSetUserRole(row.id, 'admin')}
                                                >
                                                    הפוך למנהל
                                                </button>
                                            )}
                                            {row.role === 'admin' && row.id !== user?.id && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger"
                                                    disabled={userRoleActingId === row.id}
                                                    onClick={() => void handleSetUserRole(row.id, 'user')}
                                                >
                                                    הסר הרשאת מנהל
                                                </button>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {platformAdmin && activeTab === 'girls' && (
                <div role="tabpanel" id="admin-panel-girls" aria-labelledby="admin-tab-girls" className="tab-content" tabIndex={0}>
                    <GirlsSeasonAdmin />
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
