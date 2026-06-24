import { execSync } from 'node:child_process';

const wcOnly =
  (process.env.WORLD_CUP_ONLY === 'true' || process.env.WORLD_CUP_ONLY === '1') &&
  !process.env.DATABASE_URL;

if (wcOnly) {
  console.log('WORLD_CUP_ONLY (no DATABASE_URL) — skipping db:migrate');
  execSync('npm run build --workspace=server', { stdio: 'inherit' });
} else {
  execSync('npm run db:migrate --workspace=server', { stdio: 'inherit' });
  execSync('npm run build --workspace=server', { stdio: 'inherit' });
}
