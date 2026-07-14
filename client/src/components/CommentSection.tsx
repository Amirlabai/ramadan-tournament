import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { commentsAPI } from '../api/client';
import { trackEvent } from '../utils/analytics';
import Skeleton from './skeleton/Skeleton';
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

function displayAuthor(author: string | undefined): string {
    if (!author || author === 'Anonymous') return 'אנונימי';
    return author;
}

const CommentSection = ({ matchId }: CommentSectionProps) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [author, setAuthor] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<number>(0);

    const fetchComments = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setFetchError(false);
        try {
            const response = await commentsAPI.getByMatchId(matchId, { signal });
            if (signal?.aborted) return;
            setComments(response.data);
        } catch (err) {
            if (signal?.aborted || (err as { code?: string; name?: string })?.code === 'ERR_CANCELED' || (err as { name?: string })?.name === 'CanceledError') {
                return;
            }
            console.error('Error fetching comments:', err);
            setFetchError(true);
            setComments([]);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [matchId]);

    useEffect(() => {
        const ac = new AbortController();
        void fetchComments(ac.signal);
        return () => ac.abort();
    }, [fetchComments]);

    useEffect(() => {
        if (!success) return;
        const t = window.setTimeout(() => setSuccess(''), 3000);
        return () => window.clearTimeout(t);
    }, [success]);

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
        setSuccess('');

        trackEvent('comment_submit', {
            category: 'interaction',
            properties: { matchId },
        });

        try {
            const response = await commentsAPI.create({
                matchId,
                author: author.trim() || undefined,
                content: content.trim(),
            });

            setComments((prev) => [response.data, ...prev]);
            setAuthor('');
            setContent('');
            setSuccess('התגובה נשלחה');
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
    const successId = `comment-success-${matchId}`;
    const charNearLimit = content.length >= 900;
    const submitDescribedBy = [
        error ? errorId : null,
        success ? successId : null,
    ]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
        <div className="comment-section">
            <h3 className="comment-section-title">
                תגובות
                {!loading && !fetchError ? (
                    <span className="comment-section-count">· {comments.length}</span>
                ) : null}
            </h3>

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
                    <small className={`char-count${charNearLimit ? ' char-count--warn' : ''}`}>
                        {content.length}/1000
                    </small>
                </div>
                {success ? (
                    <div id={successId} className="comment-success" role="status" aria-live="polite">
                        {success}
                    </div>
                ) : null}
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
                <p className="comment-form__terms">
                    תגובות ציבוריות — ראו{' '}
                    <Link to="/terms#user-content">תנאי שימוש</Link>.
                </p>
                <button
                    type="submit"
                    disabled={submitting || rateLimitedUntil !== null}
                    className="btn btn-primary"
                    aria-describedby={submitDescribedBy}
                >
                    {submitting ? 'שולח...' : rateLimitedUntil ? `נסה שוב בעוד ${countdown}s` : 'שלח תגובה'}
                </button>
            </form>

            <div className="comments-list" aria-live="polite">
                {loading ? (
                    <div className="comment-section__skeleton" role="status">
                        <span className="visually-hidden">טוען תגובות...</span>
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="comment-section__skeleton-item">
                                <Skeleton height="0.875rem" width="40%" />
                                <Skeleton height="1rem" width="90%" />
                                <Skeleton height="1rem" width="70%" />
                            </div>
                        ))}
                    </div>
                ) : fetchError ? (
                    <div className="comment-section__fetch-error">
                        <p>לא ניתן לטעון תגובות כרגע</p>
                        <button type="button" onClick={() => void fetchComments()}>
                            נסה שוב
                        </button>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="comment-section__empty">אין עדיין תגובות. היה הראשון להגיב!</div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="comment-item">
                            <div className="comment-header">
                                <span className="comment-author">{displayAuthor(comment.author)}</span>
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
