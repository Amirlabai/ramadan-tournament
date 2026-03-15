import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesAPI, newsAPI, authAPI, teamsAPI, adminAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { Match, News, Team } from '../../types';
import MatchTableRow from '../../components/admin/MatchTableRow';
import NewsForm from '../../components/admin/NewsForm';
import RosterManager from '../../components/admin/RosterManager';
import './AdminPanel.css';

const AdminPanel = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [news, setNews] = useState<News[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    type TabType = 'matches' | 'news' | 'import' | 'banned-words' | 'comments' | 'roster';
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('matches');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [bannedWords, setBannedWords] = useState<any[]>([]);
    const [newWord, setNewWord] = useState('');
    const [newWordLanguage, setNewWordLanguage] = useState('other');
    const [comments, setComments] = useState<any[]>([]);
    const [matchFilter, setMatchFilter] = useState<'all' | 'upcoming' | 'live' | 'finished' | 'today'>('all');
    const [automationLoading, setAutomationLoading] = useState(false);
    const [playoffSyncLoading, setPlayoffSyncLoading] = useState(false);

    const [searchFilter, setSearchFilter] = useState('');
    const navigate = useNavigate();

    const handleFileUpload = async () => {
        if (!file) return;
        if (!confirm('פעולה זו תמחק ותחליף את כל נתוני הקבוצות. להמשיך?')) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await adminAPI.uploadPlayers(formData);
            alert('ייבוא בוצע בהצלחה!');
            setFile(null);
            // Refresh logic if needed
        } catch (err: any) {
            console.error(err);
            const message = err.response?.data?.details || err.response?.data?.error || 'שגיאה בייבוא הקובץ';
            alert(message);
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/admin/login');
            return;
        }

        const fetchData = async () => {
            try {
                await authAPI.getCurrentUser();
                const [matchesRes, newsRes, teamsRes] = await Promise.all([
                    matchesAPI.getAll(),
                    newsAPI.getAll(),
                    teamsAPI.getAll()
                ]);
                const matchesSorted = matchesRes.data.sort((a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setMatches(matchesSorted);
                setNews(newsRes.data);
                setTeams(teamsRes.data);
            } catch (err) {
                console.error(err);
                localStorage.removeItem('token');
                navigate('/admin/login');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate]);

    useEffect(() => {
        if (activeTab === 'banned-words') {
            fetchBannedWords();
        } else if (activeTab === 'comments') {
            fetchComments();
        }
    }, [activeTab]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
            await newsAPI.delete(id);
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
                await newsAPI.update(editingNews.id, data);
                setNews(news.map(n => n.id === editingNews.id ? { ...n, ...data } : n));
            } else {
                const res = await newsAPI.create(data);
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
            setBannedWords(bannedWords.filter(w => w._id !== id));
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
            setComments(comments.filter(c => c._id !== id));
        } catch (err) {
            alert('שגיאה במחיקת תגובה');
        }
    };

    const handleTriggerAutomation = async () => {
        setAutomationLoading(true);
        try {
            const res = await adminAPI.triggerNewsAutomation();
            if (res.data.status === 'posted') {
                alert(`עדכון בוצע בהצלחה!\n\n${res.data.message}`);
                // Refresh news feed
                const newsRes = await newsAPI.getAll();
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

    if (loading) return <div className="loading">טוען...</div>;

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <h2>פאנל {user?.role === 'Captain' ? 'קפטן' : 'ניהול'}</h2>
                <button onClick={handleLogout} className="btn btn-danger">
                    התנתק
                </button>
            </div>

            <div className="tabs">
                {(user?.role === 'Admin' || user?.role === 'admin') && (
                    <>
                        <button
                            className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
                            onClick={() => setActiveTab('matches')}
                        >
                            ניהול משחקים ({matches.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'news' ? 'active' : ''}`}
                            onClick={() => setActiveTab('news')}
                        >
                            ניהול חדשות ({news.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
                            onClick={() => setActiveTab('import')}
                        >
                            ייבוא שחקנים
                        </button>
                        <button
                            className={`tab ${activeTab === 'banned-words' ? 'active' : ''}`}
                            onClick={() => setActiveTab('banned-words')}
                        >
                            מילים חסומות ({bannedWords.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'comments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('comments')}
                        >
                            ניהול תגובות ({comments.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'roster' ? 'active' : ''}`}
                            onClick={() => setActiveTab('roster')}
                        >
                            סגל ורישום
                        </button>
                    </>
                )}
            </div>

            {activeTab === 'matches' && (
                <div className="tab-content">
                    <div className="admin-filters mb-3">
                        <button
                            className={`filter-btn ${matchFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setMatchFilter('all')}
                        >
                            הכל
                        </button>
                        <button
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
                                                _id: 'new',
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
                                    {matches
                                        .filter(match => {
                                            if (matchFilter === 'all') return true;
                                            if (matchFilter === 'today') {
                                                const d = new Date(match.date);
                                                const now = new Date();
                                                return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                            }
                                            return getMatchStatus(match) === matchFilter;
                                        })
                                        .map((match, index) => (
                                            <MatchTableRow
                                                key={match._id}
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

            {activeTab === 'news' && (
                <div className="tab-content">
                    {!showNewsForm ? (
                        <div className="card">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h2>חדשות</h2>
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
                                    <div key={item._id} className="item">
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

            {activeTab === 'import' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>ייבוא שחקנים</h2>
                        <div className="p-4 text-center">
                            <p className="mb-4">
                                העלה קובץ CSV עם נתוני שחקנים לעדכון מהיר של כל הקבוצות.<br />
                                <strong>שים לב: פעולה זו תמחק את כל הקבוצות והשחקנים הקיימים ותחליף אותם בנתונים החדשים!</strong>
                            </p>

                            <div className="mb-3">
                                <label htmlFor="csvFile" className="form-label">קובץ CSV (players-data.csv)</label>
                                <input
                                    className="form-control"
                                    type="file"
                                    id="csvFile"
                                    accept=".csv"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                            </div>

                            <button
                                onClick={handleFileUpload}
                                className="btn btn-success btn-lg mt-3"
                                disabled={!file || uploading}
                            >
                                {uploading ? 'מעלה...' : 'ייבא שחקנים'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'banned-words' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>ניהול מילים חסומות</h2>

                        <div className="p-4">
                            <div className="mb-4">
                                <h3>הוסף מילה חדשה</h3>
                                <div className="d-flex gap-2">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="מילה חדשה"
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
                                    bannedWords.map((word) => (
                                        <div key={word._id} className="item">
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
                                                    onClick={() => handleRemoveBannedWord(word._id)}
                                                    className="btn btn-danger"
                                                >
                                                    מחק
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'comments' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>ניהול תגובות</h2>

                        <div className="p-4">
                            <div className="mb-4">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="חפש תגובות..."
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
                                            return (
                                                <div key={comment._id} className="item">
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
                                                            onClick={() => handleDeleteComment(comment._id)}
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

            {activeTab === 'roster' && (
                <div className="tab-content">
                    <div className="card p-3">
                        <RosterManager />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
