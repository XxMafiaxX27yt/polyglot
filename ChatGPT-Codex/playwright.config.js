import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --port 5179', url: 'http://127.0.0.1:5179', env: { VITE_BACKEND_URL: 'http://127.0.0.1:8019' }, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5180', url: 'http://127.0.0.1:5180', env: { VITE_BACKEND_URL: '' }, reuseExistingServer: false },
  ],
});
