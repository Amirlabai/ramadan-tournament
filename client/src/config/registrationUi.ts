/**
 * Profile “בקשה לפתיחת קבוצה חדשה” form visibility.
 * UI-only gate by design: API `POST …/creation-request` and handlers stay live
 * (pending queue / admin approve still work). Set true to show the form again.
 */
export const SHOW_PROFILE_TEAM_CREATION = false;
