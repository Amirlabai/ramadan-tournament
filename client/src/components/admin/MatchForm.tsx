import { useState, useEffect } from 'react';
import { teamsAPI } from '../../api/client';
import type { Match, Team, Goal } from '../../types';

interface MatchFormProps {
    initialData?: Match | null;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
}

const MatchForm = ({ initialData, onSubmit, onCancel }: MatchFormProps) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [formData, setFormData] = useState({
        team1Id: '',
        team2Id: '',
        score1: '',
        score2: '',
        date: '',
        location: '',
        phase: 'group',
        goals: [] as Goal[]
    });

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await teamsAPI.getAll();
                setTeams(res.data);
            } catch (err) {
                console.error('Failed to load teams', err);
            }
        };
        fetchTeams();
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData({
                team1Id: initialData.team1Id.toString(),
                team2Id: initialData.team2Id.toString(),
                score1: initialData.score1?.toString() ?? '',
                score2: initialData.score2?.toString() ?? '',
                date: new Date(initialData.date).toISOString().split('T')[0],
                location: initialData.location,
                phase: initialData.phase,
                goals: initialData.goals || []
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            team1Id: parseInt(formData.team1Id),
            team2Id: parseInt(formData.team2Id),
            score1: formData.score1 === '' ? undefined : parseInt(formData.score1),
            score2: formData.score2 === '' ? undefined : parseInt(formData.score2),
        };
        await onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
            <h4 className="mb-3">{initialData ? 'עריכת משחק' : 'הוספת משחק חדש'}</h4>

            <div className="row g-3">
                <div className="col-md-6">
                    <label htmlFor="team1Id" className="form-label">קבוצה 1</label>
                    <select id="team1Id" className="form-select" value={formData.team1Id} onChange={handleChange} required>
                        <option value="">בחר קבוצה...</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div className="col-md-6">
                    <label htmlFor="team2Id" className="form-label">קבוצה 2</label>
                    <select id="team2Id" className="form-select" value={formData.team2Id} onChange={handleChange} required>
                        <option value="">בחר קבוצה...</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>

                <div className="col-md-6">
                    <label htmlFor="score1" className="form-label">תוצאה קבוצה 1</label>
                    <input type="number" className="form-control" id="score1" value={formData.score1} onChange={handleChange} min="0" />
                </div>
                <div className="col-md-6">
                    <label htmlFor="score2" className="form-label">תוצאה קבוצה 2</label>
                    <input type="number" className="form-control" id="score2" value={formData.score2} onChange={handleChange} min="0" />
                </div>

                <div className="col-12">
                    <label htmlFor="date" className="form-label">תאריך</label>
                    <input type="date" className="form-control" id="date" value={formData.date} onChange={handleChange} required />
                </div>

                <div className="col-12">
                    <label htmlFor="location" className="form-label">מיקום</label>
                    <input type="text" className="form-control" id="location" value={formData.location} onChange={handleChange} required />
                </div>

                <div className="col-12">
                    <label htmlFor="phase" className="form-label">שלב</label>
                    <select id="phase" className="form-select" value={formData.phase} onChange={handleChange}>
                        <option value="group">שלב הבתים</option>
                        <option value="knockout">נוקאאוט</option>
                    </select>
                </div>
            </div>

            <div className="d-flex gap-2 mt-4">
                <button type="submit" className="btn btn-success flex-grow-1">שמור</button>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>ביטול</button>
            </div>
        </form>
    );
};

export default MatchForm;
