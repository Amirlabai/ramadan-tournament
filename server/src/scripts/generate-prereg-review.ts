/**
 * Build human-readable team roster review from the Google Form CSV (same parse as import).
 * Does NOT read data/preregistration/*.json — those files are local debug only, not Postgres.
 * Usage: npx tsx src/scripts/generate-prereg-review.ts [-- path/to/file.csv]
 */
import fs from 'fs';
import path from 'path';
import { parseAdigaFormCsvContent } from '../utils/parseAdigaFormCsv';

const DEFAULT_CSV = path.join(
  process.cwd(),
  '..',
  '.incoming',
  'ADIGA WORLD CUP 2026 ⚽ (תגובות) - תגובות לטופס 1(1).csv'
);

function repoRoot(): string {
  return path.join(process.cwd(), '..');
}

function resolveCsvPath(arg?: string): string {
  const csvPath = arg || DEFAULT_CSV;
  return path.isAbsolute(csvPath) ? csvPath : path.join(repoRoot(), csvPath);
}

function main(): void {
  const csvPath = resolveCsvPath(process.argv[2]);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const { full, partial, report } = parseAdigaFormCsvContent(content);
  const source = path.basename(csvPath);

  const roleHe: Record<string, string> = { captain: 'ראש קבוצה', goalkeeper: 'שוער', player: 'שחקן' };
  const teams = new Map<string, { full: typeof full; partial: typeof partial }>();

  for (const e of full) {
    if (!teams.has(e.teamName)) teams.set(e.teamName, { full: [], partial: [] });
    teams.get(e.teamName)!.full.push(e);
  }
  for (const e of partial) {
    if (!teams.has(e.teamName)) teams.set(e.teamName, { full: [], partial: [] });
    teams.get(e.teamName)!.partial.push(e);
  }

  const lines: string[] = [];
  lines.push('# ADIGA World Cup 2026 — CSV parse preview (review only)');
  lines.push('');
  lines.push('> **Not the database.** This file is a masked preview parsed from the Google Form CSV.');
  lines.push('> Live data is in **Postgres** (`form_prereg_entries`, `teams`, `players`) after `import:prereg` / `import:roster`.');
  lines.push('> `data/preregistration/*.json` is optional local debug output from `parse:prereg` — do not treat it as production state.');
  lines.push('');
  lines.push(`Source CSV: \`${source}\``);
  lines.push('');
  lines.push(
    'Complete entries auto-match identity on profile after Postgres import; partials are placeholders until users register.'
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Teams | ${teams.size} |`);
  lines.push(`| Complete identities | ${full.length} |`);
  lines.push(`| Partial (missing ID or year) | ${partial.length} |`);
  lines.push(`| Skipped / invalid | ${report.length} |`);
  lines.push('');

  type RosterEntry = (typeof full)[number] | (typeof partial)[number];

  for (const [teamName, data] of [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0], 'he'))) {
    const all: RosterEntry[] = [...data.full, ...data.partial];
    const captain = all.find((x) => x.role === 'captain');
    lines.push(`## ${teamName}`);
    lines.push('');
    lines.push(
      `- Roster slots parsed: **${all.length}** (${data.full.length} complete, ${data.partial.length} partial)`
    );
    if (captain && 'email' in captain && captain.email) lines.push(`- Captain email: ${captain.email}`);
    lines.push('');
    lines.push('| Role | Name | Status | Notes |');
    lines.push('|------|------|--------|-------|');
    const order: Record<string, number> = { captain: 0, goalkeeper: 1, player: 2 };
    const sorted = all.sort(
      (a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.name.localeCompare(b.name, 'he')
    );
    for (const e of sorted) {
      const hasFull =
        'personalId' in e && e.personalId && 'birthYear' in e && e.birthYear != null;
      const status = hasFull ? 'complete' : 'partial';
      let notes = '';
      if (!hasFull && 'adminMissing' in e) {
        notes = e.adminMissing === 'personal_id' ? 'missing ת"ז' : 'missing birth year';
        if (e.birthYear) notes += ` (year: ${e.birthYear})`;
        if (e.personalId) notes += ` (ID: ***${e.personalId.slice(-4)})`;
      } else if (hasFull && 'personalId' in e && e.personalId && 'birthYear' in e) {
        notes = `***${e.personalId.slice(-4)} / ${e.birthYear}`;
      }
      lines.push(`| ${roleHe[e.role]} | ${e.name} | ${status} | ${notes} |`);
    }
    lines.push('');
  }

  if (report.length) {
    lines.push('## Skipped rows');
    lines.push('');
    for (const s of report) {
      const rawSnippet = s.raw ? ` — \`${s.raw.slice(0, 60)}\`` : '';
      lines.push(`- **${s.teamName}** — ${s.name} (${roleHe[s.role] ?? s.role}): ${s.reason}${rawSnippet}`);
    }
    lines.push('');
  }

  lines.push('## Notes');
  lines.push('');
  lines.push('- **Partials are expected** — roster placeholders until users register and bridge identity on profile.');
  lines.push('- Regenerate after CSV changes; keep one-off manual ops notes in admin runbook, not in this file.');
  lines.push('- **Fill-only import** — CSV adds missing prereg/roster rows to Postgres only. Existing DB data (teams, players, linked users) is never updated or deleted.');
  lines.push('- Workflow: `npm run import:prereg` → `npm run import:roster -- --dry-run` → live import → fixtures.');

  const out = path.join(process.cwd(), '..', '.incoming', 'parsed-teams-review.md');
  fs.writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log(`Wrote ${out} (from CSV — not from JSON, not Postgres)`);
}

main();
