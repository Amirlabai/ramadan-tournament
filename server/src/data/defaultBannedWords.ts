export type DefaultBannedWord = {
  word: string;
  language: 'en' | 'he';
};

/** Default English profanity / slur filter (restored from pre-Postgres seed script). */
export const DEFAULT_ENGLISH_BANNED_WORDS = [
  'fuck',
  'shit',
  'damn',
  'hell',
  'ass',
  'bitch',
  'bastard',
  'crap',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'cunt',
  'piss',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'retarded',
  'chink',
  'spic',
  'kike',
  'dyke',
  'tranny',
  'fuk',
  'fck',
  'sht',
  'btch',
  'cnt',
] as const;

/** Default Hebrew profanity / slur filter (restored from pre-Postgres seed script). */
export const DEFAULT_HEBREW_BANNED_WORDS = [
  'זין',
  'כוס',
  'שרמוטה',
  'בן זונה',
  'זונה',
  'חרא',
  'מניאק',
  'קוקסינל',
  'לעזאזל',
  'טמבל',
  'דפוק',
  'מזדיין',
  'ארס',
  'כושי',
  'ערס',
  'פרייר',
  'חארות',
  'שמוק',
  'מפגר',
  'זבל',
  'זיין',
  'מזיין',
  'מצוצן',
  'חתיכת',
  'דביל',
] as const;

export const DEFAULT_BANNED_WORDS: DefaultBannedWord[] = [
  ...DEFAULT_ENGLISH_BANNED_WORDS.map((word) => ({ word, language: 'en' as const })),
  ...DEFAULT_HEBREW_BANNED_WORDS.map((word) => ({ word, language: 'he' as const })),
];
