import { defineConfig } from 'vitest/config';

// Tests run against a separate database that is reset from the migrations on every run.
// Override TEST_DATABASE_URL to point elsewhere (e.g. in CI).
const TEST_DB = process.env.TEST_DATABASE_URL ?? 'mysql://root:@localhost:3306/online_shops_test';

export default defineConfig({
  test: {
    globalSetup: './tests/global-setup.ts',
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DB,
      JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
      PLATFORM_DOMAIN: 'localhost',
      PLATFORM_HOST: 'localhost:3001',
      DEFAULT_SHOP_SLUG: '',
      INTERNAL_PROXY_SECRET: 'test-proxy-secret-0123456789abcdef',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    },
  },
});
