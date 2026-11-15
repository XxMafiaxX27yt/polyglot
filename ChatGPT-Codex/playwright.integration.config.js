import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const partB = path.resolve(root, '../Gemini-Antigravity');
const python = process.env.PART_B_PYTHON || path.join(partB, '.venv/Scripts/python.exe');
export default defineConfig({
  testDir: './tests/integration', workers: 1, timeout: 45000, outputDir: './test-results-integration',
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `"${python}" -B "${path.join(partB, 'server.py')}"`, url: 'http://127.0.0.1:8020/health', env: { FAKE_CORE: '1', PORT: '8020', HOST: '127.0.0.1', PYTHONDONTWRITEBYTECODE: '1' }, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5181', url: 'http://127.0.0.1:5181', env: { VITE_BACKEND_URL: 'http://127.0.0.1:8020' }, reuseExistingServer: false },
  ],
});
