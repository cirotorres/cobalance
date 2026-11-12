import { defineConfig, devices } from '@playwright/test';

// E2E em browser REAL (Chromium) contra backend FastAPI real + PostgreSQL descartável.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5179', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    { command: './e2e/start-backend.sh', url: 'http://127.0.0.1:18000/auth/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'npx vite --host 127.0.0.1 --port 5179 --strictPort', url: 'http://127.0.0.1:5179', reuseExistingServer: false,
      env: { VITE_API_URL: 'http://127.0.0.1:18000' }, timeout: 120_000 },
  ],
});
