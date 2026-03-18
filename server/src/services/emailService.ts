import nodemailer from 'nodemailer';
import { config } from '../config/env';

const getTransporter = () =>
    nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email.user,
            pass: config.email.pass,
        },
    });

const isConfigured = () => !!(config.email.user && config.email.pass && config.email.admin);

// ─── Photo upload (existing flow) ────────────────────────────────────────────

export const sendPhotoUploadNotification = async (playerName: string, teamName: string): Promise<void> => {
    if (!isConfigured()) return;
    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: config.email.admin,
            subject: `תמונה חדשה לאישור: ${playerName}`,
            html: `
                <div dir="rtl" style="font-family: sans-serif;">
                    <h2>היי, יש תמונה חדשה שמחכה לאישורך!</h2>
                    <p><strong>שחקן:</strong> ${playerName}</p>
                    <p><strong>קבוצה:</strong> ${teamName}</p>
                    <hr />
                    <a href="https://ramadan-tournament-client.vercel.app/admin"
                       style="background:#2A6B11;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">
                       לפאנל הניהול
                    </a>
                </div>`,
        });
        console.log(`[email] Photo notification sent for ${playerName}`);
    } catch (err) {
        console.error('[email] Failed to send photo notification:', err);
    }
};

// ─── Team creation request ────────────────────────────────────────────────────

export const sendTeamRequestNotification = async (
    requesterName: string,
    requesterEmail: string,
    teamName: string,
    description: string
): Promise<void> => {
    if (!isConfigured()) return;
    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: config.email.admin,
            subject: `בקשה חדשה לפתיחת קבוצה: ${teamName}`,
            html: `
                <div dir="rtl" style="font-family: sans-serif;">
                    <h2>בקשה חדשה לפתיחת קבוצה</h2>
                    <p><strong>מבקש:</strong> ${requesterName} (${requesterEmail})</p>
                    <p><strong>שם הקבוצה:</strong> ${teamName}</p>
                    ${description ? `<p><strong>תיאור:</strong> ${description}</p>` : ''}
                    <hr />
                    <p>כדי לאשר או לדחות את הבקשה, כנס לפאנל הניהול:</p>
                    <a href="https://ramadan-tournament-client.vercel.app/admin"
                       style="background:#2A6B11;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">
                       לפאנל הניהול
                    </a>
                </div>`,
        });
        console.log(`[email] Team request notification sent for "${teamName}"`);
    } catch (err) {
        console.error('[email] Failed to send team request notification:', err);
    }
};

// ─── Player mapping request to captain ───────────────────────────────────────

export const sendPlayerMappingNotification = async (
    captainEmail: string,
    captainName: string,
    requesterName: string,
    playerName: string,
    teamName: string
): Promise<void> => {
    if (!isConfigured()) return;
    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: captainEmail,
            subject: `שחקן מבקש להצטרף לקבוצתך: ${teamName}`,
            html: `
                <div dir="rtl" style="font-family: sans-serif;">
                    <h2>שלום ${captainName},</h2>
                    <p>משתמש חדש מבקש לשייך את עצמו לשחקן בקבוצה שלך.</p>
                    <p><strong>משתמש:</strong> ${requesterName}</p>
                    <p><strong>שחקן מבוקש:</strong> ${playerName}</p>
                    <p><strong>קבוצה:</strong> ${teamName}</p>
                    <hr />
                    <p>כדי לאשר או לדחות את הבקשה, כנס לפרופיל שלך:</p>
                    <a href="https://ramadan-tournament-client.vercel.app/profile"
                       style="background:#2A6B11;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">
                       לפרופיל שלי
                    </a>
                </div>`,
        });
        console.log(`[email] Player mapping notification sent to captain ${captainEmail}`);
    } catch (err) {
        console.error('[email] Failed to send player mapping notification:', err);
    }
};

// ─── Email Verification ──────────────────────────────────────────────────────

export const sendVerificationEmail = async (
    email: string,
    token: string,
    displayName: string
): Promise<void> => {
    if (!isConfigured()) {
        console.warn('[email] SMTP not configured. Logged code:', token);
        return;
    }
    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: email,
            subject: `קוד אימות לטורניר נצ'מאז: ${token}`,
            html: `
                <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2A6B11; text-align: center;">ברוך הבא לטורניר נצ'מאז!</h2>
                    <p>שלום ${displayName},</p>
                    <p>תודה שנרשמת למערכת. כדי להשלים את ההרשמה ולאמת את כתובת האימייל שלך, אנא הזן את הקוד הבא באתר:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; border-radius: 5px; margin: 20px 0;">
                        ${token}
                    </div>
                    <p>הקוד בתוקף ל-24 השעות הקרובות.</p>
                    <p>אם לא נרשמת לאתר, אנא התעלם מאימייל זה.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888; text-align: center;">טורניר נצ'מאז - רמדאן 2026</p>
                </div>`,
        });
        console.log(`[email] Verification email sent to ${email}`);
    } catch (err) {
        console.error('[email] Failed to send verification email:', err);
    }
};
