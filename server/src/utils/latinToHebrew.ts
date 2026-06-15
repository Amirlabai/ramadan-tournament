/**
 * Phonetic Latin → Hebrew for football player names (fallback when locale JSON has no entry).
 * Preserves hyphens and apostrophes; normalizes accents first.
 */

const DIGRAPHS: [string, string][] = [
  ['sch', 'ש'],
  ['tsch', 'צ'],
  ['sh', 'ש'],
  ['ch', "צ'"],
  ['kh', "ח'"],
  ['gh', 'ג'],
  ['ph', 'פ'],
  ['th', 'ת'],
  ['ng', 'נג'],
  ['ny', 'ני'],
  ['ll', 'י'],
  ['rr', 'ר'],
  ['ss', 'ס'],
  ['cc', 'ק'],
  ['qu', 'ק'],
  ['gu', 'ג'],
  ['ge', "ג'"],
  ['gi', "ג'"],
  ['gy', "ג'"],
  ['ce', 'ס'],
  ['ci', 'ס'],
  ['cy', 'ס'],
  ['ja', "ג'"],
  ['je', "ג'"],
  ['ji', "ג'"],
  ['jo', "ג'"],
  ['ju', "ג'"],
  ['fer', 'פר'],
  ['fel', 'פל'],
  ['gon', 'גון'],
  ['quez', 'קז'],
  ['ez', 'ז'],
];

const CHARS: Record<string, string> = {
  a: 'א',
  b: 'ב',
  c: 'ק',
  d: 'ד',
  e: 'ה',
  f: 'פ',
  g: 'ג',
  h: 'ה',
  i: 'י',
  j: "ג'",
  k: 'ק',
  l: 'ל',
  m: 'מ',
  n: 'נ',
  o: 'ו',
  p: 'פ',
  q: 'ק',
  r: 'ר',
  s: 'ס',
  t: 'ט',
  u: 'ו',
  v: 'ב',
  w: 'ו',
  x: 'קס',
  y: 'י',
  z: 'ז',
  "'": "'",
  '-': '-',
  ' ': ' ',
};

/** Manual overrides for famous / awkward auto-transliterations */
const OVERRIDES: Record<string, string> = {
  'lionel messi': 'ליאונל מסי',
  'cristiano ronaldo': "כריסטיאנו רונאלדו",
  'kylian mbappe': "קיליאן אמבפה",
  'kylian mbappé': "קיליאן אמבפה",
  'erling haaland': "ארלינג הולנד",
  'harry kane': 'הארי קיין',
  'kevin de bruyne': "קווין דה ברוינה",
  'virgil van dijk': "וירג'יל ון דייק",
  'mohamed salah': "מוחמד סלאח",
  'vinicius junior': "ויניסיוס ג'וניור",
  'vinícius júnior': "ויניסיוס ג'וניור",
  'lamine yamal': "למין ימאל",
  'jude bellingham': "ג'וד בלינגהאם",
  'rodri': 'רודרי',
  'alisson': 'אליסון',
  'neymar': 'ניימאר',
  'neymar jr': "ניימאר ג'וניור",
  'neymar jr.': "ניימאר ג'וניור",
};

function normalizeAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'dj')
    .replace(/ł/g, 'l')
    .replace(/ñ/g, 'ny')
    .replace(/ç/g, 'c');
}

function transliterateToken(token: string): string {
  let t = token.toLowerCase();
  if (t === 'jr' || t === 'jr.') return "ג'וניור";
  if (t === 'sr' || t === 'sr.') return 'סניור';
  if (t === 'ii' || t === 'iii') return t.toUpperCase();
  if (t === 'van') return 'ון';
  if (t === 'von') return 'פון';
  if (t === 'de') return 'דה';
  if (t === 'del') return 'דל';
  if (t === 'da') return 'דה';
  if (t === 'di') return 'די';
  if (t === 'la') return 'לה';
  if (t === 'le') return 'לה';
  if (t === 'mc') return 'מק';
  if (t === 'mac') return 'מק';
  if (t === 'o') return "או'";

  let out = '';
  let i = 0;
  while (i < t.length) {
    let matched = false;
    for (const [latin, heb] of DIGRAPHS) {
      if (t.startsWith(latin, i)) {
        out += heb;
        i += latin.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = t[i];
    out += CHARS[ch] ?? ch;
    i += 1;
  }
  return out;
}

function capitalizeHebrewWord(word: string): string {
  if (!word || word === '-' || word === "'") return word;
  if (/^[\u0590-\u05FF]/.test(word)) return word;
  return word;
}

/** Word-final nun (נ) → final form (ן) at end of word or before hyphen. */
export function fixHebrewFinalNun(text: string): string {
  return text.replace(/\u05E0(?=[\s\-]|$)/g, '\u05DF');
}

export function transliterateLatinName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const key = normalizeAccents(trimmed).toLowerCase();
  if (OVERRIDES[key]) return OVERRIDES[key];

  const normalized = normalizeAccents(trimmed);
  const parts = normalized.split(/\s+/);
  const hebrewParts = parts.map((part) => {
    const partKey = part.toLowerCase();
    if (OVERRIDES[partKey]) return OVERRIDES[partKey];
    return transliterateToken(part);
  });

  return fixHebrewFinalNun(hebrewParts.join(' ').replace(/\s+/g, ' ').trim());
}
