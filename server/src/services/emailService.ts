import nodemailer from 'nodemailer';
import { adminUrl, profileUrl, tournamentBranding } from '../config/tournamentBranding';
import { config } from '../config/env';

const getTransporter = () =>
    nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email.user,
            pass: config.email.pass,
        },
    });

const isSmtpConfigured = () => !!(config.email.user && config.email.pass);

const isConfigured = () => isSmtpConfigured() && !!config.email.admin;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function emailFooterHtml(): string {
    return `<p style="font-size: 12px; color: #888; text-align: center;">${tournamentBranding.displayNameHe}</p>`;
}

function emailWrapperHtml(body: string): string {
    return `
        <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            ${body}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            ${emailFooterHtml()}
        </div>`;
}

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
                    <a href="${adminUrl()}"
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
                    <a href="${adminUrl()}"
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
            html: emailWrapperHtml(`
                <h2 style="color: #2A6B11;">שלום ${captainName},</h2>
                <p>משתמש חדש מבקש לשייך את עצמו לשחקן בקבוצה שלך ב${tournamentBranding.displayNameHe}.</p>
                <p><strong>משתמש:</strong> ${requesterName}</p>
                <p><strong>שחקן מבוקש:</strong> ${playerName}</p>
                <p><strong>קבוצה:</strong> ${teamName}</p>
                <hr />
                <p>כדי לאשר או לדחות את הבקשה, כנס לפרופיל שלך:</p>
                <a href="${profileUrl()}"
                   style="background:#2A6B11;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">
                   לפרופיל שלי
                </a>
            `),
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
    if (!isSmtpConfigured()) {
        console.warn('[email] SMTP not configured. Logged code:', token);
        return;
    }
    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: email,
            subject: `קוד אימות — ${tournamentBranding.displayNameHe}`,
            html: emailWrapperHtml(`
                <h2 style="color: #2A6B11; text-align: center;">ברוך הבא ל${tournamentBranding.displayNameHe}!</h2>
                <p>שלום ${displayName},</p>
                <p>תודה שנרשמת למערכת. כדי להשלים את ההרשמה ולאמת את כתובת האימייל שלך, אנא הזן את הקוד הבא באתר:</p>
                <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; border-radius: 5px; margin: 20px 0;">
                    ${token}
                </div>
                <p>הקוד בתוקף ל-24 השעות הקרובות.</p>
                <p>אם לא נרשמת לאתר, אנא התעלם מאימייל זה.</p>
            `),
        });
        console.log(`[email] Verification email sent to ${email}`);
    } catch (err) {
        console.error('[email] Failed to send verification email:', err);
    }
};

// ─── Password reset ───────────────────────────────────────────────────────────

export const sendPasswordResetEmail = async (
    email: string,
    resetUrl: string,
    displayName: string
): Promise<void> => {
    if (!isSmtpConfigured()) {
        throw new Error('SMTP not configured');
    }
    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: email,
            subject: `איפוס סיסמה — ${tournamentBranding.displayNameHe}`,
            html: buildPasswordResetEmailHtml(resetUrl, displayName),
        });
        console.log(`[email] Password reset email sent to ${email}`);
    } catch (err) {
        console.error('[email] Failed to send password reset email:', err);
        throw err;
    }
};

function buildPasswordResetEmailHtml(resetUrl: string, displayName: string): string {
    const safeName = escapeHtml(displayName);
    const safeUrl = escapeHtml(resetUrl);
    return emailWrapperHtml(`
        <h2 style="color: #2A6B11; text-align: center;">איפוס סיסמה</h2>
        <p>שלום ${safeName},</p>
        <p>קיבלנו בקשה לאיפוס הסיסמה שלך ב${tournamentBranding.displayNameHe}. לחץ על הכפתור למטה כדי לבחור סיסמה חדשה:</p>
        <p style="text-align: center; margin: 24px 0;">
            <a href="${safeUrl}"
               style="background:#2A6B11;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold;">
               איפוס סיסמה
            </a>
        </p>
        <p style="font-size: 13px; color: #666;">הקישור בתוקף לשעה אחת. אם לא ביקשת איפוס סיסמה, אפשר להתעלם מהודעה זו.</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">אם הכפתור לא עובד, העתק את הקישור: ${safeUrl}</p>
    `);
}

/** @internal test helper — build password reset HTML without sending */
export function buildPasswordResetEmailHtmlForTest(
    resetUrl: string,
    displayName: string
): string {
    return buildPasswordResetEmailHtml(resetUrl, displayName);
}

// ─── Administration-side identity gap (form CSV incomplete) ─────────────────

export type PreregIdentityAlert =
  | { type: 'admin_missing'; field: 'personal_id' | 'birth_year' }
  | { type: 'field_mismatch'; field: 'personal_id' | 'birth_year' };

const MISMATCH_LABELS: Record<'personal_id' | 'birth_year', string> = {
  personal_id: 'מספר תעודת זהות',
  birth_year: 'שנת לידה',
};

export const sendPreregIdentityAlertEmail = async (
  to: string,
  displayName: string,
  alert: PreregIdentityAlert
): Promise<void> => {
  if (!isSmtpConfigured() || !to?.trim()) return;

  const fieldLabel = MISMATCH_LABELS[alert.field];
  let subject: string;
  let body: string;

  if (alert.type === 'admin_missing') {
    subject = `השלמת רישום — חסר ${fieldLabel} בצד הניהול`;
    body = `
      <h2 style="color: #2A6B11;">שלום ${displayName},</h2>
      <p>ברישום <strong>${tournamentBranding.displayNameHe}</strong> בצד הניהול חסר/ה ${fieldLabel} בטופס ההרשמה.</p>
      <p>אנא <strong>השיבו למייל זה</strong> עם ${fieldLabel} כדי שנוכל להשלים את הרישום.</p>
      <p>תודה.</p>
    `;
  } else {
    subject = `השלמת רישום — ${fieldLabel} לא תואם לטופס`;
    body = `
      <h2 style="color: #2A6B11;">שלום ${displayName},</h2>
      <p>ברישום <strong>${tournamentBranding.displayNameHe}</strong> אחד הפרטים ששלחת תואם לטופס ההרשמה ואחד לא.</p>
      <p>אנא <strong>השיבו למייל זה</strong> עם ${fieldLabel} הנכון/ה כדי שנוכל להשלים את הרישום.</p>
      <p>תודה.</p>
    `;
  }

  try {
    await getTransporter().sendMail({
      from: config.email.user,
      to,
      replyTo: config.email.admin || config.email.user,
      subject,
      html: emailWrapperHtml(body),
    });
    console.log(`[email] Prereg identity alert sent to ${to}`);
  } catch (err) {
    console.error('[email] Failed to send prereg identity alert:', err);
  }
};

/** @deprecated use sendPreregIdentityAlertEmail */
export const sendAdminGapIdentityEmail = async (
    to: string,
    displayName: string,
    adminMissing: ('personal_id' | 'birth_year')[]
): Promise<void> => {
  if (adminMissing.length === 0) return;
  const field = adminMissing.length === 2 ? 'personal_id' : adminMissing[0]!;
  await sendPreregIdentityAlertEmail(to, displayName, { type: 'admin_missing', field });
};

/** @internal test helper — build verification HTML without sending */
export function buildVerificationEmailHtmlForTest(
    token: string,
    displayName: string
): string {
    return emailWrapperHtml(`
        <h2>ברוך הבא ל${tournamentBranding.displayNameHe}!</h2>
        <p>שלום ${displayName},</p>
        <div>${token}</div>
    `);
}

/** @internal test helper */
export function buildPreregAlertHtmlForTest(
  displayName: string,
  alert: PreregIdentityAlert
): string {
  const fieldLabel = MISMATCH_LABELS[alert.field];
  const intro =
    alert.type === 'admin_missing'
      ? `חסר ${fieldLabel} בצד הניהול`
      : `${fieldLabel} לא תואם`;
  return emailWrapperHtml(`
        <p>שלום ${displayName},</p>
        <p>${intro}</p>
    `);
}

/** @internal test helper */
export function buildAdminGapEmailHtmlForTest(
  displayName: string,
  adminMissing: ('personal_id' | 'birth_year')[]
): string {
  const field = adminMissing[0] ?? 'birth_year';
  return buildPreregAlertHtmlForTest(displayName, { type: 'admin_missing', field });
}
