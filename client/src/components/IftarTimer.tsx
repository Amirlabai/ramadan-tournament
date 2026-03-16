import './IftarTimer.css';

interface IftarTimerProps {
    isActive: boolean;
    onToggle: (active: boolean) => void;
}

const RAMADAN_START = new Date(2026, 1, 18); // Feb 18, 2026

const getMoonEmoji = (day: number): string => {
    if (day <= 10) return '🌙';
    if (day <= 20) return '🌕';
    return '🌘';
};

const getMoonIllumination = (day: number): { percentage: string; trend: string } => {
    // Approx illumination using cosine: 0% at day 1, 100% at day 15, 0% at day 29.5
    // Cycle is ~29.53 days.
    const phase = ((day - 1) % 29.53) / 29.53;
    const illumination = 50 * (1 - Math.cos(phase * 2 * Math.PI));

    // Trend: waxing (0 to 0.5) vs waning (0.5 to 1.0)
    let trend = phase <= 0.5 ? 'ירח מתמלא' : 'ירח מתמעט';

    // Refine for very close states
    if (illumination >= 98) trend = 'ירח מלא';
    if (illumination <= 2) trend = 'מולד הירח';

    return {
        percentage: illumination.toFixed(2),
        trend
    };
};

const IftarTimer = ({ isActive, onToggle }: IftarTimerProps) => {
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const ramadanDay = Math.floor((today.getTime() - RAMADAN_START.getTime()) / msPerDay) + 1;

    const emoji = getMoonEmoji(ramadanDay);
    const { percentage, trend } = getMoonIllumination(ramadanDay);

    return (
        <div className={`iftar-timer-container ${isActive ? 'expanded' : 'minimized'}`}>
            <div className="iftar-bubble-content">
                <button
                    className="iftar-close-btn"
                    onClick={() => onToggle(false)}
                    title="מזער"
                >
                    ×
                </button>
                <iframe
                    src="https://aymanlauz.github.io/ramadan-countdown/"
                    title="Ramadan Countdown"
                    className="iftar-iframe"
                    loading="lazy"
                />
                <div className="moon-data">
                    {trend} ({percentage}% הארה)
                </div>
            </div>

            <button
                className="iftar-toggle-btn"
                onClick={() => onToggle(true)}
                title="הצג ספירה לאחור"
            >
                <span className="moon-emoji">{emoji}</span>
            </button>
        </div>
    );
};

export default IftarTimer;
