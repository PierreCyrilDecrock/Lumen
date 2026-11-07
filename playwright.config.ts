import { defineConfig, devices } from '@playwright/test';

/** End-to-end tests on the production build, served under /Lumen/ like GitHub Pages. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174/Lumen/',
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort --base /Lumen/',
    url: 'http://localhost:4174/Lumen/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
    {
      name: 'ordinateur',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
