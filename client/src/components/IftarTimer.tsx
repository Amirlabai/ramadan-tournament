import { useEffect } from 'react';
import './IftarTimer.css';

interface IftarTimerProps {
    isActive: boolean;
    onToggle: (active: boolean) => void;
}

const RAMADAN_START = new Date(2026, 1, 18); // Feb 18, 2026

const getMoonEmoji = (): string => {
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const day = Math.floor((today.getTime() - RAMADAN_START.getTime()) / msPerDay) + 1;
    if (day <= 10) return '🌙';
    if (day <= 20) return '🌕';
    return '🌘';
};

const IftarTimer = ({ isActive, onToggle }: IftarTimerProps) => {
    useEffect(() => {
        if (isActive && window.scrollY < 201) {
            window.scrollTo({
                top: 201, // Threshold to trigger NewsBanner collapse and Navbar stickiness
                behavior: 'smooth'
            });
        }
    }, [isActive]);

    return (
        <div className={`iftar-timer-container ${!isActive ? 'minimized' : ''}`}>
            {!isActive ? (
                <button
                    className="iftar-toggle-btn"
                    onClick={() => onToggle(true)}
                    title="הצג ספירה לאחור"
                >
                    {getMoonEmoji()}
                </button>
            ) : (
                <div className="iftar-bubble">
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
                </div>
            )}
        </div>
    );
};

export default IftarTimer;
