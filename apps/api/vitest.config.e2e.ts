import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://marketbd:marketbd@localhost:5440/marketbd_test?schema=public';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL, OTP_PROVIDER: 'console' },
    // Suites share one database, so run them one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
  },
});
