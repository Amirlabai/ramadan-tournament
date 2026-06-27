import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      MOCK_DEV_DATA: '1',
      JWT_SECRET: 'test-jwt-secret',
      NODE_ENV: 'test',
    },
  },
});
