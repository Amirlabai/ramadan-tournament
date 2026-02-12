import { useState, useEffect } from 'react';
import type { News } from '../../types';

interface NewsFormProps {
    initialData?: News | null;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
}

const NewsForm = ({ initialData, onSubmit, onCancel }: NewsFormProps) => {
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        date: new Date().toISOString().split('T')[0],
        priority: 'normal'
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title,
                message: initialData.message,
                date: new Date(initialData.date).toISOString().split('T')[0],
                priority: initialData.priority
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
            <h4 className="mb-3">{initialData ? 'עריכת חדשה' : 'הוספת חדשה'}</h4>

            <div className="mb-3">
                <label htmlFor="title" className="form-label">כותרת</label>
                <input type="text" className="form-control" id="title" value={formData.title} onChange={handleChange} required />
            </div>

            <div className="mb-3">
                <label htmlFor="message" className="form-label">תוכן ההודעה</label>
                <textarea className="form-control" id="message" rows={4} value={formData.message} onChange={handleChange} required></textarea>
            </div>

            <div className="row g-3">
                <div className="col-md-6">
                    <label htmlFor="date" className="form-label">תאריך</label>
                    <input type="date" className="form-control" id="date" value={formData.date} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                    <label htmlFor="priority" className="form-label">עדיפות</label>
                    <select id="priority" className="form-select" value={formData.priority} onChange={handleChange}>
                        <option value="normal">רגיל</option>
                        <option value="high">גבוה</option>
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

export default NewsForm;
