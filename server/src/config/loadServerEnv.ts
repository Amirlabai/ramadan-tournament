import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const serverRoot = path.join(__dirname, '../..');
const serverEnvPath = path.join(serverRoot, '.env');
const mockEnvPath = path.join(serverRoot, 'env.mock');

function isMockDevMode(): boolean {
  return (
    process.env.npm_lifecycle_event === 'dev:mock' ||
    process.env.MOCK_DEV_DATA === '1' ||
    process.env.MOCK_DEV_DATA === 'true'
  );
}

/** Load server/.env only (never repo root). Safe to import from seed/scripts. */
export function loadServerEnv(): void {
  if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath, override: true });
  }

  if (isMockDevMode()) {
    if (fs.existsSync(mockEnvPath)) {
      dotenv.config({ path: mockEnvPath, override: true });
    } else {
      process.env.MOCK_DEV_DATA = '1';
    }
  }
}

/** For scripts where __dirname differs (e.g. prisma seed via tsx). */
export function loadServerEnvFromCwd(): void {
  const cwdEnv = path.join(process.cwd(), '.env');
  const cwdMock = path.join(process.cwd(), 'env.mock');
  if (fs.existsSync(cwdEnv)) {
    dotenv.config({ path: cwdEnv, override: true });
  }
  if (isMockDevMode()) {
    if (fs.existsSync(cwdMock)) {
      dotenv.config({ path: cwdMock, override: true });
    } else {
      process.env.MOCK_DEV_DATA = '1';
    }
  }
}

export { serverEnvPath, mockEnvPath, serverRoot };
