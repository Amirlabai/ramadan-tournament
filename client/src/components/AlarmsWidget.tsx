import { useState, useEffect } from 'react';
import './AlarmsWidget.css';

interface AlarmsData {
    last_updated: string;
    stats: {
        total: number;
        cities: Record<string, number>;
    };
    data: Array<{
        time: string;
        cities: string;
        threat: string;
        description: string;
    }>;
}

interface AlarmsWidgetProps {
    isActive: boolean;
    onToggle: (active: boolean) => void;
}

const AlarmsWidget = ({ isActive, onToggle }: AlarmsWidgetProps) => {
    const [alarms, setAlarms] = useState<AlarmsData | null>(null);

    useEffect(() => {
        fetch('/data/alarms.json')
            .then(res => {
                if (!res.ok) throw new Error('Failed to load alarms data');
                return res.json();
            })
            .then((data: AlarmsData) => setAlarms(data))
            .catch(err => console.error('AlarmsWidget:', err));
    }, []);

    if (!alarms) return null;

    return (
        <div className={`alarms-widget-container ${!isActive ? 'minimized' : ''}`}>
            {!isActive ? (
                <button
                    className="alarms-toggle-btn"
                    onClick={() => onToggle(true)}
                    title="הצג נתוני התרעות"
                >
                    📢
                </button>
            ) : (
                <div className="alarms-bubble">
                    <button
                        className="alarms-close-btn"
                        onClick={() => onToggle(false)}
                        title="מזער"
                    >
                        ×
                    </button>
                    <div className="alarms-content">
                        <div className="alarms-header">
                            <span className="alarms-icon">📢</span>
                            <span className="alarms-title">נתוני התרעות (מ-28/02)</span>
                        </div>
                        <div className="alarms-stats">
                            <div className="stat-item main">
                                <span className="stat-label">סה"כ התרעות:</span>
                                <span className="stat-value">{alarms.stats.total}</span>
                            </div>
                            <div className="cities-grid">
                                {Object.entries(alarms.stats.cities).map(([city, count]) => (
                                    <div key={city} className="stat-item city">
                                        <span className="stat-label">{city}:</span>
                                        <span className="stat-value">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="alarms-footer">
                            עדכון אחרון: {new Date(alarms.last_updated).toLocaleString('he-IL')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlarmsWidget;
