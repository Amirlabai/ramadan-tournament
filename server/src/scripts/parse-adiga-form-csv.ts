/**
 * Parse Google Forms team registration CSV into preregistration JSON files (debug output).
 * Usage: npm run parse:prereg [-- path/to/file.csv]
 */
import fs from 'fs';
import path from 'path';
import { parseAdigaFormCsvContent } from '../utils/parseAdigaFormCsv';

const DEFAULT_CSV = path.join(
  process.cwd(),
  '..',
  '.incoming',
  'ADIGA WORLD CUP 2026 ⚽ (תגובות) - תגובות לטופס 1.csv'
);

const OUT_DIR = path.join(process.cwd(), '..', 'data', 'preregistration');

function repoRoot(): string {
  return path.join(process.cwd(), '..');
}

function main(): void {
  const csvPath = process.argv[2] || DEFAULT_CSV;
  const resolved = path.isAbsolute(csvPath) ? csvPath : path.join(repoRoot(), csvPath);

  if (!fs.existsSync(resolved)) {
    console.error(`CSV not found: ${resolved}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const { full, partial, report } = parseAdigaFormCsvContent(content);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = path.basename(resolved);

  fs.writeFileSync(
    path.join(OUT_DIR, 'adiga-form-entries.json'),
    JSON.stringify({ source, generatedAt, entries: full }, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'adiga-form-partial.json'),
    JSON.stringify({ source, generatedAt, entries: partial }, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'adiga-form-parse-report.json'),
    JSON.stringify(
      { source, generatedAt, fullCount: full.length, partialCount: partial.length, skipped: report },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`Parsed ${full.length} complete, ${partial.length} partial, ${report.length} skipped`);
  console.log(`Wrote ${OUT_DIR}`);
}

main();
