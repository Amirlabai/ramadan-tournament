import { useState, useEffect } from 'react';
import { teamsAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import './CaptainTeamRequests.css';

const VITE_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

interface PendingUser {
    _id: string;
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
    const [requests, setRequests] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Assuming the captain's user record contains their team ID in some way.
    // For now, as an admin/captain, we will let them manage the team they are approved for.
    // Assuming for Captain role, 'mappedPlayerInfo' points to their team.
    const captainTeamId = user?.mappedPlayerInfo?.teamId;
    const captainTeamName = (user?.mappedPlayerInfo as any)?.teamName || `קבוצה #${captainTeamId}`;

    useEffect(() => {
        const fetchRequests = async () => {
            if (!captainTeamId) {
                setLoading(false);
                return;
            }

            try {
                const response = await teamsAPI.getRequests(captainTeamId);
                setRequests(response.data);
            } catch (err) {
                setError('שגיאה בטעינת בקשות ממתינות');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [captainTeamId]);

    const handleAction = async (userId: string, action: 'approved' | 'rejected') => {
        if (!captainTeamId) return;

        setActionLoading(userId);
        try {
            await teamsAPI.approveRequest(captainTeamId, userId, action);
            // Remove the user from the pending list
            setRequests(prev => prev.filter(req => req._id !== userId));
        } catch (err: any) {
            alert(err.response?.data?.error || 'שגיאה בביצוע הפעולה');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div>טוען בקשות...</div>;
    if (!captainTeamId) return <div className="alert alert-warning">לא נמצאה קבוצה המשויכת לקפטן זה.</div>;
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
                                <tr key={req._id}>
                                    <td>
                                        <div className="d-flex align-items-center gap-3">
                                            {req.avatarUrl ? (
                                                <img
                                                    src={req.avatarUrl.startsWith('http') ? req.avatarUrl : `${VITE_API_URL}${req.avatarUrl}`}
                                                    alt=""
                                                    className="avatar-sm rounded-circle"
                                                />
                                            ) : (
                                                <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                                                    <i className="bi bi-person"></i>
                                                </div>
                                            )}
                                            {req.displayName}
                                        </div>
                                    </td>
                                    <td dir="ltr" className="text-end">{req.email}</td>
                                    <td>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-theme-green btn-sm px-3"
                                                onClick={() => handleAction(req._id, 'approved')}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === req._id ? <span className="spinner-border spinner-border-sm" /> : 'אשר'}
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm px-3"
                                                onClick={() => handleAction(req._id, 'rejected')}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === req._id ? <span className="spinner-border spinner-border-sm" /> : 'דחה'}
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
