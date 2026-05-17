import { useState, type FormEvent } from 'react';
import SEO from '../components/SEO';
import './Accessibility.css';

/** Single source for coordinator contact — update before production deploy */
const COORDINATOR_EMAIL = 'summertournament@gmail.com';
const COORDINATOR_NAME = 'FAAFO';
const COORDINATOR_PHONE = '0501234567';

const Accessibility = () => {
    const [submitted, setSubmitted] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const subject = encodeURIComponent('דיווח על בעיית נגישות - טורניר קיץ 2026');
        const body = encodeURIComponent(
            `שם: ${name}\nדוא"ל: ${email}\n\n${message}`
        );
        window.location.href = `mailto:${COORDINATOR_EMAIL}?subject=${subject}&body=${body}`;
        setSubmitted(true);
    };

    return (
        <div className="container py-4 accessibility-page">
            <SEO
                title="הצהרת נגישות"
                description="הצהרת נגישות לאתר טורניר קיץ 2026. תקן ישראלי ת״י 5568 ו-WCAG 2.1 רמה AA. פרטי רכז נגישות וטופס לדיווח על בעיות."
                url="https://ramadan-tournament-client.vercel.app/accessibility"
            />
            <h2 className="mb-4 fw-bold text-success border-bottom pb-2">הצהרת נגישות</h2>

            <section className="mb-4">
                <h3>רמת התאמה</h3>
                <p>
                    אתר זה שואף לעמוד בדרישות תקן ישראלי ת&quot;י 5568 לנגישות תכנים באינטרנט,
                    המבוסס על הנחיות WCAG 2.1 ברמה AA.
                </p>
                <p><strong>תאריך ביקורת נגישות אחרונה:</strong> מאי 2026</p>
            </section>

            <section className="mb-4">
                <h3>מגבלות ידועות</h3>
                <ul>
                    <li>ווידג׳ט התחברות Google — נשלט על ידי ספק חיצוני</li>
                    <li>ספריות Bootstrap ו-Font Awesome מ-CDN</li>
                    <li>תרשימי התרעות — מוצגים כתמונה חזותית עם תיאור טקסטואלי</li>
                </ul>
            </section>

            <section className="mb-4">
                <h3>רכז נגישות</h3>
                <ul className="list-unstyled">
                    <li><strong>שם:</strong> {COORDINATOR_NAME}</li>
                    <li><strong>דוא&quot;ל:</strong> <a href={`mailto:${COORDINATOR_EMAIL}`}>{COORDINATOR_EMAIL}</a></li>
                    <li><strong>טלפון:</strong> <a href={`tel:${COORDINATOR_PHONE}`}>{COORDINATOR_PHONE}</a></li>
                </ul>
                <p className="text-muted">
                    אנו מתחייבים לטפל בפניות נגישות בתוך 5 ימי עסקים ממועד קבלת הפנייה.
                </p>
            </section>

            <section className="mb-4">
                <h3>דיווח על בעיית נגישות</h3>
                {submitted ? (
                    <div className="alert alert-success" role="alert">
                        תודה. נפתחה אפליקציית דוא&quot;ל לשליחת הפנייה. אם לא נפתחה, שלחו דוא&quot;ל לכתובת הרכז.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="accessibility-report-form" noValidate>
                        <div className="mb-3">
                            <label htmlFor="a11y-name" className="form-label">שם מלא</label>
                            <input
                                type="text"
                                id="a11y-name"
                                name="name"
                                className="form-control"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                                required
                                aria-required="true"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="a11y-email" className="form-label">דוא&quot;ל</label>
                            <input
                                type="email"
                                id="a11y-email"
                                name="email"
                                className="form-control"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                aria-required="true"
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="a11y-message" className="form-label">תיאור הבעיה</label>
                            <textarea
                                id="a11y-message"
                                name="message"
                                className="form-control"
                                rows={5}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                                aria-required="true"
                            />
                        </div>
                        <button type="submit" className="btn btn-theme-green">
                            שלח דיווח
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
};

export default Accessibility;
