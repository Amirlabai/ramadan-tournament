import { useState, useEffect, useMemo } from 'react';
import { teamsAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useNavActionIndicators } from '../../contexts/NavActionIndicatorsContext';
import { resolveLegacyCaptainTeam } from '../../utils/navActionIndicators';
import './CaptainTeamRequests.css';

const VITE_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

interface PendingUser {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    mappedPlayerInfo: {
        teamId: number;
        memberId: number;
        status: string;
    };
}

const CaptainTeamRequests = () => {
    const { user } = useAuth();
    const { refreshIndicators } = useNavActionIndicators();
    const [requests, setRequests] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const captainTeam = useMemo(() => resolveLegacyCaptainTeam(user), [user]);
    const captainTeamId = captainTeam?.teamId;
    const captainTeamSlug = captainTeam?.slug ?? 'boys';
    const captainTeamName = captainTeam?.teamName ?? '';

    useEffect(() => {
        const fetchRequests = async () => {
            if (!captainTeamId) {
                setLoading(false);
                return;
            }

            try {
                const response = await teamsAPI.getRequests(captainTeamId, captainTeamSlug);
                setRequests(response.data);
            } catch {
                setError('שגיאה בטעינת בקשות ממתינות');
            } finally {
                setLoading(false);
            }
        };

        void fetchRequests();
    }, [captainTeamId, captainTeamSlug]);

    const handleAction = async (userId: string, action: 'approved' | 'rejected') => {
        if (!captainTeamId) return;

        setActionLoading(userId);
        try {
            await teamsAPI.approveRequest(captainTeamId, userId, action, captainTeamSlug);
            setRequests((prev) => prev.filter((req) => req.id !== userId));
            await refreshIndicators();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { error?: string } } };
            alert(ax.response?.data?.error || 'שגיאה בביצוע הפעולה');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div>טוען בקשות...</div>;
    if (!captainTeamId) {
        return <div className="alert alert-warning">לא נמצאה קבוצה המשויכת לקפטן זה.</div>;
    }
    if (error) return <div className="alert alert-danger">{error}</div>;

    return (
        <div className="captain-requests">
            <h4 className="requests-subtitle mb-4">
                <i className="bi bi-person-check me-2" />
                בקשות שיוך ל{captainTeamName}
            </h4>

            {requests.length === 0 ? (
                <div className="alert alert-info">אין בקשות שיוך ממתינות לקבוצה שלך.</div>
            ) : (
                <div className="matches-table-wrapper">
                    <table className="matches-table align-middle">
                        <thead>
                            <tr>
                                <th>שם משתמש</th>
                                <th>אימייל</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((req) => (
                                <tr key={req.id}>
                                    <td>
                                        <div className="d-flex align-items-center gap-3">
                                            {req.avatarUrl ? (
                                                <img
                                                    src={
                                                        req.avatarUrl.startsWith('http')
                                                            ? req.avatarUrl
                                                            : `${VITE_API_URL}${req.avatarUrl}`
                                                    }
                                                    alt=""
                                                    className="avatar-sm rounded-circle"
                                                />
                                            ) : (
                                                <div
                                                    className="bg-secondary rounded-circle d-flex align-items-center justify-content-center"
                                                    style={{ width: 32, height: 32 }}
                                                >
                                                    <i className="bi bi-person" />
                                                </div>
                                            )}
                                            {req.displayName}
                                        </div>
                                    </td>
                                    <td dir="ltr" className="text-end">
                                        {req.email}
                                    </td>
                                    <td>
                                        <div className="d-flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-theme-green btn-sm px-3"
                                                onClick={() => void handleAction(req.id, 'approved')}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === req.id ? (
                                                    <span className="spinner-border spinner-border-sm" />
                                                ) : (
                                                    'אשר'
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm px-3"
                                                onClick={() => void handleAction(req.id, 'rejected')}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === req.id ? (
                                                    <span className="spinner-border spinner-border-sm" />
                                                ) : (
                                                    'דחה'
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CaptainTeamRequests;
