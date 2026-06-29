import { useState, useEffect } from 'react';
import { commentsAPI } from '../api/client';
import './CommentSection.css';

interface Comment {
    id: string;
    matchId: number;
    author: string;
    content: string;
    createdAt: string;
}

interface CommentSectionProps {
    matchId: number;
}

const CommentSection = ({ matchId }: CommentSectionProps) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [author, setAuthor] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<number>(0);

    useEffect(() => {
        fetchComments();
    }, [matchId]);

    useEffect(() => {
        if (rateLimitedUntil) {
            const interval = setInterval(() => {
                const now = Date.now();
                const remainingMs = rateLimitedUntil - now;

                if (remainingMs <= 0) {
                    setRateLimitedUntil(null);
                    setCountdown(0);
                    setError('');
                } else {
                    setCountdown(Math.ceil(remainingMs / 1000));
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [rateLimitedUntil]);

    const fetchComments = async () => {
        try {
            const response = await commentsAPI.getByMatchId(matchId);
            setComments(response.data);
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!content.trim()) {
            setError('תוכן ההודעה לא יכול להיות ריק');
            return;
        }

        if (content.length > 1000) {
            setError('ההודעה ארוכה מדי (מקסימום 1000 תווים)');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await commentsAPI.create({
                matchId,
                author: author.trim() || undefined,
                content: content.trim(),
            });

            setComments([response.data, ...comments]);
            setAuthor('');
            setContent('');
        } catch (err: any) {
            if (err.response?.status === 429) {
                const retryAfter = err.response.headers['retry-after'];
                const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5 * 60 * 1000;
                setRateLimitedUntil(Date.now() + waitMs);
                setError(err.response?.data?.error || 'יותר מדי תגובות. נסה שוב בעוד מספר דקות.');
            } else {
                setError(err.response?.data?.error || 'שגיאה בשליחת התגובה');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('he-IL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const authorId = `comment-author-${matchId}`;
    const contentId = `comment-content-${matchId}`;
    const errorId = `comment-error-${matchId}`;

    return (
        <div className="comment-section">
            <h3 className="comment-section-title">תגובות</h3>

            <form onSubmit={handleSubmit} className="comment-form">
                <div className="form-group">
                    <label htmlFor={authorId} className="form-label">שם (אופציונלי)</label>
                    <input
                        type="text"
                        id={authorId}
                        name="author"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        maxLength={100}
                        className="form-control"
                        autoComplete="name"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor={contentId} className="form-label">תגובה</label>
                    <textarea
                        id={contentId}
                        name="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        className="form-control"
                        required
                        aria-required="true"
                        aria-invalid={!!error}
                        aria-describedby={error ? errorId : undefined}
                    />
                    <small className="char-count">{content.length}/1000</small>
                </div>
                {error && (
                    <div id={errorId} className="error-message" role="alert">
                        {error}
                        {countdown > 0 && (
                            <div className="countdown-timer">
                                נסה שוב בעוד {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                            </div>
                        )}
                    </div>
                )}
                <button type="submit" disabled={submitting || rateLimitedUntil !== null} className="btn btn-primary">
                    {submitting ? 'שולח...' : rateLimitedUntil ? `נסה שוב בעוד ${countdown}s` : 'שלח תגובה'}
                </button>
            </form>

            <div className="comments-list" aria-live="polite">
                {loading ? (
                    <div className="comment-section__loading" role="status">
                        <span className="visually-hidden">טוען תגובות...</span>
                        טוען תגובות...
                    </div>
                ) : comments.length === 0 ? (
                    <div className="comment-section__empty">אין עדיין תגובות. היה הראשון להגיב!</div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="comment-item">
                            <div className="comment-header">
                                <span className="comment-author">{comment.author}</span>
                                <span className="comment-date">{formatDate(comment.createdAt)}</span>
                            </div>
                            <div className="comment-content">{comment.content}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CommentSection;
