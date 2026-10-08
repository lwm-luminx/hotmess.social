import { defineConfig, devices } from '@playwright/test';

// End-to-end tests in Chromium, in two suites:
//
//   npm run e2e        the built site (astro preview) with Facebook and the API
//                      mocked, so every page and failure state is covered on
//                      each pull request. Run `npm run build` first.
//   npm run e2e:live   the deployed site against the real API, signed in as a
//                      Facebook test user (see e2e/live/session.ts).
const live = process.env.E2E_SUITE === 'live';
const PORT = 4321;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  },
  projects: [
    {
      name: 'app',
      testDir: 'e2e/app',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORT}` },
    },
    {
      name: 'live',
      testDir: 'e2e/live',
      use: { ...devices['Desktop Chrome'], baseURL: process.env.E2E_BASE_URL ?? 'https://hotmess.social' },
    },
  ],
  webServer: live ? undefined : {
    command: `npx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
