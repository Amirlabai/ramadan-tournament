import { useState, useEffect, useRef } from 'react';
import './AlarmsWidget.css';

interface BinEntry {
    time: string;   // "HH:MM"
    count: number;
}

interface AlarmsData {
    last_updated: string;
    stats: {
        total: number;
        cities: Record<string, number>;
    };
    bins: Record<string, BinEntry[]>;
    predictions: Record<string, string | null>;
}

interface AlarmsWidgetProps {
    isActive: boolean;
    onToggle: (active: boolean) => void;
}

const CITY_LABELS: Record<string, string> = {
    'כפר כמא': 'כפר כמא',
    'ריחאנייה': 'ריחאנייה',
};

function BarChart({ bins }: { bins: BinEntry[] }) {
    const maxCount = Math.max(...bins.map(b => b.count), 1);
    // Only show bins that have at least 1 alarm, plus minimal hour labels
    const nonEmpty = bins.filter(b => b.count > 0);
    if (nonEmpty.length === 0) {
        return <div className="chart-empty">אין נתונים</div>;
    }

    // Group by hour for labels
    const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

    return (
        <div className="bar-chart" role="img" aria-label="פיזור התרעות לפי שעה">
            <div className="bar-chart-bars">
                {bins.map((bin) => {
                    const heightPct = (bin.count / maxCount) * 100;
                    const showLabel = hourLabels.some(h => bin.time === `${String(h).padStart(2, '0')}:00`);
                    return (
                        <div key={bin.time} className="bar-wrapper" title={`${bin.time} — ${bin.count} התרעות`}>
                            <div
                                className="bar"
                                style={{ height: `${heightPct}%` }}
                            />
                            {showLabel && (
                                <span className="bar-label">{bin.time.slice(0, 2)}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CityCard({
    city,
    count,
    bins,
    prediction,
}: {
    city: string;
    count: number;
    bins: BinEntry[];
    prediction: string | null;
}) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
    const cardRef = useRef<HTMLDivElement>(null);

    // Close popover when clicking outside on mobile
    useEffect(() => {
        if (!isMobile || !popoverOpen) return;
        const handler = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                setPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isMobile, popoverOpen]);

    const handleInteraction = () => {
        if (isMobile) setPopoverOpen(prev => !prev);
    };

    const predictedLabel = prediction
        ? new Date(prediction).toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        })
        : null;

    return (
        <div
            ref={cardRef}
            className={`city-card ${popoverOpen ? 'popover-open' : ''}`}
            onMouseEnter={() => { if (!isMobile) setPopoverOpen(true); }}
            onMouseLeave={() => { if (!isMobile) setPopoverOpen(false); }}
            onClick={handleInteraction}
        >
            <div className="city-card-row">
                <span className="city-name">{CITY_LABELS[city] ?? city}</span>
                <span className="city-count">{count}</span>
            </div>

            {popoverOpen && (
                <div className="city-popover">
                    <div className="popover-title">פיזור שעתי (28/02 –)</div>
                    <BarChart bins={bins} />
                    {predictedLabel && (
                        <div className="popover-prediction">
                            <span className="prediction-label">תחזית הבאה:</span>
                            <span className="prediction-value">{predictedLabel}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
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
                                    <CityCard
                                        key={city}
                                        city={city}
                                        count={count}
                                        bins={alarms.bins?.[city] ?? []}
                                        prediction={alarms.predictions?.[city] ?? null}
                                    />
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
