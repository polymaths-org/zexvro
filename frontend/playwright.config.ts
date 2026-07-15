import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npx vite --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
