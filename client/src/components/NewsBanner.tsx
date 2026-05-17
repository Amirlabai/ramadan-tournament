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

    if (!newsItem) return null;

    return (
        <section className={`news-banner ${isCollapsed ? 'collapsed' : ''}`}>
            <button
                type="button"
                className="news-banner-toggle w-100 border-0 bg-transparent text-start p-0"
                aria-expanded={!isCollapsed}
                aria-controls="news-banner-content"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <h2 className="h4 mb-0">{newsItem.title}</h2>
                {isCollapsed && (
                    <span className="expand-indicator">הרחב חדשות</span>
                )}
            </button>
            <div
                id="news-banner-content"
                className="news-content-wrapper"
                hidden={isCollapsed}
                aria-hidden={isCollapsed}
            >
                <div className="news-content">
                    <p className="mb-0">{newsItem.message}</p>
                </div>
            </div>
        </section>
    );
};

export default NewsBanner;
