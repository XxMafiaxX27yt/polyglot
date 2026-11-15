import { test, expect } from '@playwright/test';
import { installMic, join } from '../browser/helpers.js';

test('Part C talks to the actual Part B fake core with browser WebM and WAV playback', async ({ context, page, request }, testInfo) => {
  const response = await request.get('http://127.0.0.1:8020/health');
  expect(await response.json()).toEqual({ ok: true, fake: true });
  await installMic(context);
  await context.addInitScript(() => { const nativeSend = WebSocket.prototype.send; WebSocket.prototype.send = function(data) { if (data instanceof Blob) (window.testRecordedAudio ??= []).push(data); return nativeSend.call(this, data); }; });

  const errors = [], received = [], returned = [], sent = [], listenerSent = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('websocket', (ws) => {
    if (!ws.url().includes(':8020/ws')) return;
    ws.on('framereceived', ({ payload }) => { if (Buffer.isBuffer(payload)) returned.push(payload); });
    ws.on('framesent', ({ payload }) => { if (typeof payload === 'string') sent.push(JSON.parse(payload)); });
  });
  await join(page, 'ActualSpeaker', 'http://127.0.0.1:5181', 'hi');
  const listener = await context.newPage();
  listener.on('pageerror', (error) => errors.push(error.message));
  listener.on('websocket', (ws) => {
    if (!ws.url().includes(':8020/ws')) return;
    ws.on('framereceived', ({ payload }) => { if (Buffer.isBuffer(payload)) received.push(payload); });
    ws.on('framesent', ({ payload }) => { if (typeof payload === 'string') listenerSent.push(JSON.parse(payload)); });
  });
  await join(listener, 'ActualListener', 'http://127.0.0.1:5181');
  await expect(page.locator('.tile-name').filter({ hasText: 'ActualListener' })).toBeVisible();
  await expect(listener.getByText('Live / fake core', { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.locator('.call-top').click({ position: { x: 20, y: 20 } });
  await page.evaluate(async () => { await window.testMic.ctx.resume(); window.testMic.gain.gain.value = 0.25; });

  await expect.poll(() => sent.some((message) => message.type === 'audio_start')).toBe(true);
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.testMic.gain.gain.value = 0; });
  await expect(listener.locator('.t-translated').first()).not.toBeEmpty();
  await expect.poll(() => received.length).toBeGreaterThan(0);
  expect(sent.some((message) => message.type === 'audio_end')).toBe(true);
  expect(await page.evaluate(async () => Array.from(new Uint8Array(await window.testRecordedAudio[0].arrayBuffer())).slice(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(received[0].subarray(0, 4).toString()).toBe('RIFF');
  await expect(listener.locator('.call-meta .stat').filter({ hasText: 'stub timing' }).first()).toBeVisible();
  await expect(listener.getByRole('alert')).toHaveCount(0);
  await expect(listener.locator('.loader')).toHaveCount(0);
  await listener.screenshot({ path: testInfo.outputPath('actual-part-b-live.png'), fullPage: true });
  await listener.bringToFront();
  await listener.locator('.call-top').click({ position: { x: 20, y: 20 } });
  await listener.evaluate(async () => { await window.testMic.ctx.resume(); window.testMic.gain.gain.value = 0.25; });
  await expect.poll(() => listenerSent.some((message) => message.type === 'audio_start')).toBe(true);
  await listener.waitForTimeout(700);
  await listener.evaluate(() => { window.testMic.gain.gain.value = 0; });
  await expect(page.locator('.t-translated').first()).not.toBeEmpty();
  await expect.poll(() => returned.length).toBeGreaterThan(0);
  expect(returned[0].subarray(0, 4).toString()).toBe('RIFF');
  const actualResults = await request.get('http://127.0.0.1:8020/results');
  expect(actualResults.ok()).toBe(true);
  const evaluation = await actualResults.json();
  const resultsPage = await context.newPage();
  await resultsPage.goto('http://127.0.0.1:5181/#/results');
  await expect(resultsPage.getByText('Backend evaluation file', { exact: true })).toBeVisible();
  await expect(resultsPage.getByRole('columnheader', { name: 'Copy baseline chrF ↑', exact: true })).toBeVisible();
  const table = resultsPage.getByRole('region', { name: 'MT scores by language pair', exact: true });
  await expect(table.getByRole('row')).toHaveCount(Object.keys(evaluation.mt).length + 1);
  await resultsPage.close();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(listener.locator('.tile-name').filter({ hasText: 'ActualSpeaker' })).toHaveCount(0);
  expect(errors).toEqual([]);
});







