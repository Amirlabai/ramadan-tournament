import fs from 'fs';

/** Read JSON from disk; strips UTF-8 BOM if present (common on Windows). */
export function readJsonFromFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as T;
}
