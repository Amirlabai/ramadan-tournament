import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesAPI, newsAPI, authAPI } from '../../api/client';
import type { Match, News } from '../../types';
import MatchForm from '../../components/admin/MatchForm';
import NewsForm from '../../components/admin/NewsForm';
import './AdminPanel.css';

const AdminPanel = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [news, setNews] = useState<News[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'matches' | 'news'>('matches');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/admin/login');
            return;
        }

        const fetchData = async () => {
            try {
                await authAPI.getCurrentUser();
                const [matchesRes, newsRes] = await Promise.all([
                    matchesAPI.getAll(),
                    newsAPI.getAll()
                ]);
                setMatches(matchesRes.data);
                setNews(newsRes.data);
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

    const [editingMatch, setEditingMatch] = useState<Match | null>(null);
    const [editingNews, setEditingNews] = useState<News | null>(null);
    const [showMatchForm, setShowMatchForm] = useState(false);
    const [showNewsForm, setShowNewsForm] = useState(false);

    // ... (rest of imports and state)

    const handleSaveMatch = async (data: any) => {
        try {
            if (editingMatch) {
                await matchesAPI.update(editingMatch.id, data);
                setMatches(matches.map(m => m.id === editingMatch.id ? { ...m, ...data } : m));
            } else {
                const res = await matchesAPI.create(data);
                setMatches([res.data, ...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
            setShowMatchForm(false);
            setEditingMatch(null);
        } catch (err) {
            alert('שגיאה בשמירת משחק');
            console.error(err);
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

    const startEditMatch = (match: Match) => {
        setEditingMatch(match);
        setShowMatchForm(true);
    };

    const startEditNews = (item: News) => {
        setEditingNews(item);
        setShowNewsForm(true);
    };

    if (loading) return <div className="loading">טוען...</div>;

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <h1>פאנל ניהול</h1>
                <button onClick={handleLogout} className="btn btn-danger">
                    התנתק
                </button>
            </div>

            <div className="tabs">
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
            </div>

            {activeTab === 'matches' && (
                <div className="tab-content">
                    {!showMatchForm ? (
                        <div className="card">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h2>משחקים</h2>
                                <button className="btn btn-primary" onClick={() => { setEditingMatch(null); setShowMatchForm(true); }}>
                                    + הוסף משחק חדש
                                </button>
                            </div>
                            <div className="items-list">
                                {matches.map(match => (
                                    <div key={match._id} className="item">
                                        <div className="item-info">
                                            <strong>
                                                קבוצה {match.team1Id} vs קבוצה {match.team2Id}
                                            </strong>
                                            <span>{new Date(match.date).toLocaleDateString('he-IL')}</span>
                                            <span>תוצאה: {match.score1 ?? '-'} : {match.score2 ?? '-'}</span>
                                        </div>
                                        <div className="item-actions">
                                            <button onClick={() => startEditMatch(match)} className="btn btn-warning ms-2">ערוך</button>
                                            <button onClick={() => deleteMatch(match.id)} className="btn btn-danger">מחק</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <MatchForm
                            initialData={editingMatch}
                            onSubmit={handleSaveMatch}
                            onCancel={() => { setShowMatchForm(false); setEditingMatch(null); }}
                        />
                    )}
                </div>
            )}

            {activeTab === 'news' && (
                <div className="tab-content">
                    {!showNewsForm ? (
                        <div className="card">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h2>חדשות</h2>
                                <button className="btn btn-primary" onClick={() => { setEditingNews(null); setShowNewsForm(true); }}>
                                    + הוסף חדשה
                                </button>
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
        </div>
    );
};

export default AdminPanel;
