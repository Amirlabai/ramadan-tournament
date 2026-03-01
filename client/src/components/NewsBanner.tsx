import { useEffect, useState } from 'react';
import { newsAPI } from '../api/client';
import type { News } from '../types';

const NewsBanner = () => {
    const [newsItem, setNewsItem] = useState<News | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const response = await newsAPI.getAll();
                const newsData = response.data;

                if (newsData.length > 0) {
                    // Sort by priority (high first) then date (newest first)
                    const sortedNews = [...newsData].sort((a, b) => {
                        if (a.priority === 'high' && b.priority !== 'high') return -1;
                        if (b.priority === 'high' && a.priority !== 'high') return 1;
                        return new Date(b.date).getTime() - new Date(a.date).getTime();
                    });
                    setNewsItem(sortedNews[0]);
                }
            } catch (err) {
                console.error('Failed to fetch news:', err);
            }
        };

        fetchNews();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsCollapsed(true);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!newsItem) return null;

    return (
        <div
            className={`news-banner ${isCollapsed ? 'collapsed' : ''}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ cursor: 'pointer' }}
        >
            <div id="newsBanner">
                <h4>{newsItem.title}</h4>
                <div className="news-content">
                    <p>{newsItem.message}</p>
                </div>
                {isCollapsed && (
                    <div className="expand-indicator">לחץ להרחבה...</div>
                )}
            </div>
        </div>
    );
};

export default NewsBanner;

