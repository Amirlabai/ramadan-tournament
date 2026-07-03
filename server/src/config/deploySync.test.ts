import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '../../..');

function readRenderApiOrigin(): string {
  const src = readFileSync(
    join(REPO_ROOT, 'client/src/config/deploy.ts'),
    'utf8'
  );
  const match = src.match(/RENDER_API_ORIGIN\s*=\s*'([^']+)'/);
  if (!match) {
    throw new Error('RENDER_API_ORIGIN not found in client/src/config/deploy.ts');
  }
  return match[1];
}

function apiRewriteDestinations(vercelJsonPath: string): string[] {
  const json = JSON.parse(readFileSync(join(REPO_ROOT, vercelJsonPath), 'utf8')) as {
    rewrites?: { source: string; destination: string }[];
  };
  return (json.rewrites ?? [])
    .filter((r) => r.source === '/api/:path*' || r.source === '/uploads/:path*')
    .map((r) => r.destination);
}

describe('deploy config sync', () => {
  const origin = readRenderApiOrigin();

  it.each(['client/vercel.json', 'vercel.json'])(
    '%s rewrites /api and /uploads to RENDER_API_ORIGIN',
    (relPath) => {
      const destinations = apiRewriteDestinations(relPath);
      expect(destinations).toContain(`${origin}/api/:path*`);
      expect(destinations).toContain(`${origin}/uploads/:path*`);
    }
  );
});
