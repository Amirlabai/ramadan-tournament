import { useState, useEffect, useCallback } from 'react';
import { iftarAPI } from '../api/client';
import './IftarTimer.css';

interface IftarTime {
    date: string;
    time: string;
    islam_data: string;
}

const IftarTimer = () => {
    const [nextIftar, setNextIftar] = useState<IftarTime | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [minimized, setMinimized] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    const getMoonEmoji = (islamData: string): string => {
        // Extract day number from islam_data (format: "X رمضان 1447")
        const dayMatch = islamData.match(/^(\d+)/);
        if (!dayMatch) return '🌙';

        const day = parseInt(dayMatch[1], 10);

        if (day <= 10) return '🌙'; // First 10 days: crescent moon
        if (day <= 20) return '🌕'; // Second 10 days: full moon
        return '🌘'; // Last 10 days: waning crescent (mirror crescent)
    };

    const calculateTimeLeft = useCallback(() => {
        if (!nextIftar) return '';

        const now = new Date();
        const jerusalemNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));

        const [hours, minutes] = nextIftar.time.split(':').map(Number);

        // Parse the date from nextIftar and construct the Iftar time in Jerusalem timezone
        const iftarTime = new Date(jerusalemNow);
        const [year, month, day] = nextIftar.date.split('-').map(Number);
        iftarTime.setFullYear(year);
        iftarTime.setMonth(month - 1); // Month is 0-indexed
        iftarTime.setDate(day);
        iftarTime.setHours(hours, minutes, 0, 0);

        // If time passed for today (and we somehow still have today's iftar), handle gracefully
        // But backend should give us the *next* iftar.
        // If we fetched today's iftar but it's already passed (race condition), diff will be negative.
        let diff = iftarTime.getTime() - jerusalemNow.getTime();

        if (diff < 0) {
            // Fetch next iftar again or just show empty/loading
            return '00:00:00';
        }

        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, [nextIftar]);

    useEffect(() => {
        const fetchIftar = async () => {
            try {
                const res = await iftarAPI.getNext();
                setNextIftar(res.data);
                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch Iftar time', err);
                setLoading(false);
            }
        };

        fetchIftar();
    }, []);

    useEffect(() => {
        if (!nextIftar) return;

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [nextIftar, calculateTimeLeft]);

    if (loading || !nextIftar) return null;

    return (
        <div className={`iftar-timer-container ${minimized ? 'minimized' : ''}`}>
            {minimized ? (
                <button
                    className="iftar-toggle-btn"
                    onClick={() => setMinimized(false)}
                    title="הצג ספירה לאחור"
                >
                    {getMoonEmoji(nextIftar.islam_data)}
                </button>
            ) : (
                <div className="iftar-bubble">
                    <button
                        className="iftar-close-btn"
                        onClick={() => setMinimized(true)}
                        title="מזער"
                    >
                        ×
                    </button>
                    <div className="iftar-content">
                        <div className="iftar-icon">{getMoonEmoji(nextIftar.islam_data)}</div>
                        <div className="iftar-info">
                            <div className="iftar-label">
                                {nextIftar.date === "2026-02-17" || new Date() < new Date("2026-02-17") ? "✨" : "איפטר הבא"}
                            </div>
                            <div className="iftar-countdown">{timeLeft}</div>
                            <div className="iftar-details-hover">
                                <div>{nextIftar.islam_data}</div>
                                <div>{nextIftar.date}</div>
                                <div>שעה: {nextIftar.time}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IftarTimer;
