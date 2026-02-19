import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchesAPI, newsAPI, authAPI, teamsAPI, adminAPI } from '../../api/client';
import type { Match, News, Team } from '../../types';
import MatchForm from '../../components/admin/MatchForm';
import NewsForm from '../../components/admin/NewsForm';
import './AdminPanel.css';

const AdminPanel = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [news, setNews] = useState<News[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'matches' | 'news' | 'import' | 'banned-words' | 'comments' | 'photos' | 'players'>('matches');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [bannedWords, setBannedWords] = useState<any[]>([]);
    const [newWord, setNewWord] = useState('');
    const [newWordLanguage, setNewWordLanguage] = useState('other');
    const [comments, setComments] = useState<any[]>([]);
    const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
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
        } else if (activeTab === 'photos') {
            fetchPendingPhotos();
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

    const [editingMatch, setEditingMatch] = useState<Match | null>(null);
    const [editingNews, setEditingNews] = useState<News | null>(null);
    const [showMatchForm, setShowMatchForm] = useState(false);
    const [showNewsForm, setShowNewsForm] = useState(false);

    const handleSaveMatch = async (data: any) => {
        try {
            if (editingMatch) {
                await matchesAPI.update(editingMatch.id, data);
                setMatches(matches.map(m => m.id === editingMatch.id ? { ...m, ...data } : m).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            } else {
                const res = await matchesAPI.create(data);
                setMatches([...matches, res.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
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

    const getTeamName = (teamId: number) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `קבוצה ${teamId}`;
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

    const fetchPendingPhotos = async () => {
        try {
            const res = await adminAPI.getPendingPhotos();
            setPendingPhotos(res.data);
        } catch (err) {
            console.error('Error fetching pending photos:', err);
        }
    };

    const handleApprovePhoto = async (teamId: number, memberId: number) => {
        if (!confirm('האם לאשר את התמונה?')) return;
        try {
            await adminAPI.approvePhoto(teamId, memberId);
            setPendingPhotos(pendingPhotos.filter(p => !(p.teamId === teamId && p.memberId === memberId)));
            alert('התמונה אושרה בהצלחה');
        } catch (err) {
            console.error(err);
            alert('שגיאה באישור התמונה');
        }
    };

    const handleRejectPhoto = async (teamId: number, memberId: number) => {
        if (!confirm('האם לדחות את התמונה? הפעולה תמחוק את הקובץ.')) return;
        try {
            await adminAPI.rejectPhoto(teamId, memberId);
            setPendingPhotos(pendingPhotos.filter(p => !(p.teamId === teamId && p.memberId === memberId)));
            alert('התמונה נדחתה ונמחקה');
        } catch (err) {
            console.error(err);
            alert('שגיאה בדחיית התמונה');
        }
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
                    className={`tab ${activeTab === 'photos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('photos')}
                >
                    אישור תמונות ({pendingPhotos.length})
                </button>
                <button
                    className={`tab ${activeTab === 'players' ? 'active' : ''}`}
                    onClick={() => setActiveTab('players')}
                >
                    ניהול שחקנים
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
                                                {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
                                            </strong>
                                            <span>
                                                {new Intl.DateTimeFormat('he-IL', {
                                                    year: 'numeric',
                                                    month: 'numeric',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    timeZone: 'Asia/Jerusalem'
                                                }).format(new Date(match.date))}
                                            </span>
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

            {activeTab === 'photos' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>אישור תמונות שחקנים</h2>
                        <div className="p-4">
                            {pendingPhotos.length === 0 ? (
                                <div className="text-center text-muted p-5">
                                    <h4>אין תמונות שממתינות לאישור</h4>
                                    <p>כל התמונות טופלו בהצלחה!</p>
                                </div>
                            ) : (
                                <div className="row g-4">
                                    {pendingPhotos.map((photo) => {
                                        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');
                                        const photoUrl = `${apiUrl}${photo.pendingPhoto}`;

                                        return (
                                            <div key={`${photo.teamId}-${photo.memberId}`} className="col-12 col-md-6 col-lg-4">
                                                <div className="card h-100 shadow-sm">
                                                    <div className="card-header bg-light">
                                                        <strong>{photo.firstName} {photo.lastName}</strong>
                                                        <div className="small text-muted">{photo.teamName}</div>
                                                    </div>
                                                    <div className="card-body text-center">
                                                        <div className="mb-3" style={{ height: '200px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
                                                            <img
                                                                src={photoUrl}
                                                                alt={`${photo.firstName}`}
                                                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                                            />
                                                        </div>
                                                        {photo.currentPhoto && (
                                                            <div className="small text-muted mb-2">
                                                                ישנה תמונה קיימת במערכת
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="card-footer d-flex justify-content-between gap-2">
                                                        <button
                                                            className="btn btn-outline-danger flex-grow-1"
                                                            onClick={() => handleRejectPhoto(photo.teamId, photo.memberId)}
                                                        >
                                                            <i className="bi bi-x-lg"></i> דחה
                                                        </button>
                                                        <button
                                                            className="btn btn-success flex-grow-1"
                                                            onClick={() => handleApprovePhoto(photo.teamId, photo.memberId)}
                                                        >
                                                            <i className="bi bi-check-lg"></i> אשר
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'players' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>ניהול שחקנים ותמונות</h2>
                        <div className="p-4">
                            <div className="mb-4">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="חפש שחקן לפי שם..."
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                />
                            </div>

                            <div className="row g-4">
                                {teams.flatMap(team =>
                                    team.players.map(player => ({ ...player, teamName: team.name, teamId: team.id }))
                                )
                                    .filter(player =>
                                        !searchFilter ||
                                        (player.firstName + ' ' + player.lastName).toLowerCase().includes(searchFilter.toLowerCase()) ||
                                        player.teamName.toLowerCase().includes(searchFilter.toLowerCase())
                                    )
                                    .slice(0, 50) // Limit display for performance
                                    .map(player => {
                                        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');
                                        const hasPhoto = !!player.head_photo;
                                        const photoUrl = hasPhoto
                                            ? (player.head_photo!.startsWith('http') ? player.head_photo : `${apiUrl}${player.head_photo}`)
                                            : null;

                                        return (
                                            <div key={`${player.teamId}-${player.memberId}`} className="col-12 col-md-6 col-lg-4">
                                                <div className="card h-100 shadow-sm">
                                                    <div className="card-header d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <strong>{player.firstName} {player.lastName}</strong>
                                                            <div className="small text-muted">{player.teamName}</div>
                                                        </div>
                                                        <span className="badge bg-secondary">#{player.number}</span>
                                                    </div>
                                                    <div className="card-body text-center">
                                                        <div className="mb-3 mx-auto" style={{
                                                            width: '120px',
                                                            height: '120px',
                                                            borderRadius: '50%',
                                                            overflow: 'hidden',
                                                            backgroundColor: '#f0f0f0',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: hasPhoto ? '3px solid #198754' : '1px solid #ddd'
                                                        }}>
                                                            {hasPhoto ? (
                                                                <img
                                                                    src={photoUrl!}
                                                                    alt={player.firstName}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                />
                                                            ) : (
                                                                <i className="bi bi-person-fill" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                                                            )}
                                                        </div>

                                                        {player.pending_head_photo ? (
                                                            <div className="badge bg-warning text-dark mb-2">ממתין לאישור תמונה</div>
                                                        ) : (
                                                            hasPhoto ? (
                                                                <div className="text-success small mb-2"><i className="bi bi-check-circle-fill"></i> יש תמונה</div>
                                                            ) : (
                                                                <div className="text-muted small mb-2">אין תמונה</div>
                                                            )
                                                        )}
                                                    </div>
                                                    <div className="card-footer">
                                                        <button
                                                            className="btn btn-outline-danger w-100"
                                                            disabled={!hasPhoto}
                                                            onClick={async () => {
                                                                if (!confirm(`האם אתה בטוח שברצונך למחוק את התמונה של ${player.firstName}?`)) return;
                                                                try {
                                                                    await adminAPI.deletePlayerPhoto(player.teamId, player.memberId);
                                                                    // Refresh teams data
                                                                    const res = await teamsAPI.getAll();
                                                                    setTeams(res.data);
                                                                    alert('התמונה נמחקה בהצלחה');
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('שגיאה במחיקת התמונה');
                                                                }
                                                            }}
                                                        >
                                                            <i className="bi bi-trash"></i> מחק תמונה
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
