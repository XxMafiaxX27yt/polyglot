import { test, expect } from '@playwright/test';
import { installMic, join, protocolPeer } from './helpers.js';

test('two live listeners: real WebM capture, contract captions, audio, language, mute, leave', async ({ context, page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installMic(context);
  const server = await protocolPeer(context);
  await join(page, 'Speaker');
  await expect(page.getByText('connected', { exact: true })).toBeVisible();
  const listener = await context.newPage();
  listener.on('pageerror', (error) => errors.push(error.message));
  await join(listener, 'Listener');
  await expect(listener.getByText('Live / fake core', { exact: true })).toBeVisible();
  await expect(listener.locator('.tile-name').filter({ hasText: 'Speaker' })).toBeVisible();
  await expect(page.locator('.tile-name').filter({ hasText: 'Listener' })).toBeVisible();
  if (await listener.getByRole('button', { name: 'Enable translated audio' }).isVisible()) await listener.getByRole('button', { name: 'Enable translated audio' }).click();
  if (await page.getByRole('button', { name: 'Enable translated audio' }).isVisible()) await page.getByRole('button', { name: 'Enable translated audio' }).click();
  await page.evaluate(async () => { await window.testMic.ctx.resume(); window.testMic.gain.gain.value = 0.25; });
  await expect.poll(() => server.events.includes('audio_start')).toBe(true);
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.testMic.gain.gain.value = 0; });
  await expect.poll(() => server.recordings.length).toBeGreaterThan(0);
  await expect(page.locator('.call-title [role=status]')).toContainText('Audio sent · microphone ready');
  const first = server.recordings[0];
  expect(first.id).toBe(first.startId);
  expect(first.bytes.length).toBeGreaterThan(100);
  expect(first.bytes.subarray(0, 4).toString('hex')).toBe('1a45dfa3');
  expect(server.events.indexOf('audio_start')).toBeLessThan(server.events.indexOf('binary'));
  expect(server.events.indexOf('binary')).toBeLessThan(server.events.indexOf('audio_end'));
  await expect(listener.locator('.t-translated').first()).toHaveText('Hello team');
  await expect(listener.locator('.t-original').first()).toHaveText('नमस्ते team');
  await expect(listener.locator('.call-meta .stat').filter({ hasText: 'stub timing' }).first()).toBeVisible();
  await listener.getByRole('button', { name: 'Change speaking and listening language', exact: true }).click();
  await listener.getByRole('radio', { name: /Tamil/ }).click();
  await expect.poll(() => [...server.peers.values()].find((p) => p.profile.name === 'Listener')?.profile.lang).toBe('ta');
  await listener.getByRole('button', { name: 'Translation on — show original captions and mute audio', exact: true }).click();
  await expect(listener.getByText(/Showing original captions/)).toBeVisible();
  const listenerWs = [...server.peers.values()].find((p) => p.profile.name === 'Listener').ws;
  server.send(listenerWs, { type: 'error', message: 'Test-only backend error' });
  await expect(listener.getByRole('alert')).toContainText('Test-only backend error');
  await listener.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(listener.locator('.loader')).toHaveCount(0);
  await listener.screenshot({ path: testInfo.outputPath('live-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  const count = server.recordings.length;
  await page.evaluate(() => { window.testMic.gain.gain.value = 0.25; });
  await page.waitForTimeout(1000);
  expect(server.recordings.length).toBe(count);
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect.poll(() => server.peers.size).toBe(1);
  await expect(listener.locator('.tile-name').filter({ hasText: 'Speaker' })).toHaveCount(0);
  await listenerWs.close({ code: 1011, reason: 'Test disconnect' });
  await expect(listener.getByText('disconnected', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('unset backend preserves labeled scripted demo and 16 untested choices', async ({ context, page }) => {
  await installMic(context);
  let sockets = 0;
  page.on('websocket', (ws) => { if (ws.url().includes(':8019/ws')) sockets++; });
  await join(page, 'Demo', 'http://127.0.0.1:5180');
  await expect(page.getByText('Demo mode', { exact: true })).toBeVisible();
  await expect(page.locator('.call-meta .stat').filter({ hasText: 'first audio · simulated' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Change speaking and listening language', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(20);
  await expect(page.locator('.lang-grid').getByText('Untested', { exact: true })).toHaveCount(16);
  expect(sockets).toBe(0);
});

test('results without real artifact is honest and remains usable on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/results.json', (route) => route.fulfill({ status: 404 }));
  await page.goto('http://127.0.0.1:5180/#results');
  await expect(page.getByRole('button', { name: /Retry|Refresh/ })).toBeVisible();
  await expect(page.getByText(/No.*results|not.*available|not.*published/i).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('results-mobile-empty.png'), fullPage: true });
});



test('results renders contract data including zeros, five failures, and static fallback', async ({ page }, testInfo) => {
  // Deliberately synthetic test values, never shipped in public/results.json.
  const fixture = {
    generated: '2026-11-14T12:00:00Z',
    asr: { hi: { wer: 0, n: 2 }, ta: { wer: 0.2, n: 5 }, hinglish: { wer: 0.5, n: 2 } },
    mt: { 'en-hi': { nllb: { chrf: 0 }, gemini: { chrf: 50 }, n: 2 } },
    hinglish: { baseline: { wer: 0.5, chrf: 40 }, fix: { wer: 0, chrf: 60 }, n: 2 },
    latencyMs: { asr: 0, mt: 20, tts: 30 },
    worst: Array.from({ length: 6 }, (_, i) => ({ lang: 'ta', input: `Test input ${i + 1}`, model: `Wrong ${i + 1}`, correct: `Correct ${i + 1}`, why: 'Synthetic test example' })),
  };
  let backendAvailable = true;
  await page.route('http://127.0.0.1:8019/results', (route) => backendAvailable ? route.fulfill({ json: fixture }) : route.fulfill({ status: 503 }));
  await page.route('http://127.0.0.1:5179/results.json', (route) => route.fulfill({ json: fixture }));
  await page.goto('http://127.0.0.1:5179/results');
  await expect(page.getByText('Backend evaluation file', { exact: true })).toBeVisible();
  const asr = page.getByRole('region', { name: 'ASR scores per language' });
  await expect(asr.getByRole('row', { name: 'Hindi 0% 2', exact: true })).toBeVisible();
  await expect(asr.getByRole('row', { name: 'Tamil 20% 5', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hinglish baseline and fix' }).getByRole('row', { name: 'Ours (fix) 60 0%', exact: true })).toBeVisible();
  await expect(page.locator('.results-failure')).toHaveCount(5);
  await expect(page.getByText('Test input 6', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Wrong 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Correct 1', { exact: true })).toBeVisible();
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('results-desktop-fixture.png'), fullPage: true });
  backendAvailable = false;
  await page.getByRole('button', { name: 'Refresh results', exact: true }).click();
  await expect(page.getByText('Published evaluation file', { exact: true })).toBeVisible();
  await expect(page.getByText(/Backend results unavailable/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('results-mobile-fixture.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Join as guest', exact: true })).toBeVisible();
});




