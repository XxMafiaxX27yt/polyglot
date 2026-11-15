import { test, expect } from '@playwright/test';
import { installMic, join, protocolPeer } from './helpers.js';

test('guest reaches dashboard, schedules locally, changes settings and opens Results', async ({ context, page }, info) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await installMic(context);
  await page.goto('http://127.0.0.1:5180');
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click();
  await page.getByRole('button', { name: 'Join as guest', exact: true }).click();
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Dashboard', exact: true });
  await expect(page.locator('.prototype-banner')).toContainText('saved in this browser only');
  await nav.getByRole('button', { name: 'Schedule Meeting', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Schedule meeting', exact: true });
  await form.getByLabel('Meeting title', { exact: true }).fill('Local test meeting');
  await form.getByRole('button', { name: 'Schedule meeting', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Meeting details', exact: true });
  await expect(details.getByRole('heading', { name: 'Local test meeting', exact: true })).toBeVisible();
  await expect(details).toContainText('saved in this browser only');
  await details.getByRole('button', { name: 'Close', exact: true }).click();
  await nav.getByRole('button', { name: 'Upcoming Meetings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Local test meeting', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Midnight', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
  await expect(page.getByLabel('Default speaking and listening language').locator('option').filter({ hasText: 'Untested' })).toHaveCount(16);
  await page.getByRole('switch', { name: 'Animated background', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('v2-settings.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('v2-settings-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole('button', { name: 'Privacy & Security', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Privacy/ }).first()).toBeVisible();
  await nav.getByRole('button', { name: 'Results', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Measured results', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(nav).toBeVisible();
  expect(errors).toEqual([]);
});

test('guest fallback works with denied media and blocked persistent storage', async ({ context, page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Test storage denied', 'SecurityError'); } });
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test mic denied', 'NotAllowedError'); };
  });
  const server = await protocolPeer(context);
  await join(page, 'NoMic');
  await expect(page.getByText('connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No microphone available', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'No camera available', exact: true })).toBeDisabled();
  expect([...server.peers.values()].some((p) => p.profile.name === 'NoMic')).toBe(true);
  expect(errors).toEqual([]);
});

test('live host controls stay unavailable and voice styles leave captions unchanged', async ({ context, page }) => {
  await installMic(context);
  const server = await protocolPeer(context);
  await join(page, 'Styles');
  await page.getByRole('button', { name: 'Host controls', exact: true }).click();
  await expect(page.getByText(/Live host controls are unavailable/)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Lock meeting', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voice effects', exact: true }).click();
  await page.getByRole('switch', { name: 'Enable voice effects', exact: true }).click();
  await page.getByRole('radio', { name: /Robot/ }).click();
  await page.getByRole('button', { name: 'Voice effects', exact: true }).click();
  await page.getByRole('button', { name: 'Transcript', exact: true }).click();
  const peer = [...server.peers.values()].find((p) => p.profile.name === 'Styles');
  server.send(peer.ws, { type: 'utterance_end', id: 'exact-text', speakerId: 'peer', sourceLang: 'hi', targetLang: 'en', original: 'नमस्ते', translated: 'Unmodified translation', latencyMs: 0, stageMs: { asr: 0, mt: 0, tts: 0 } });
  await expect(page.locator('.t-translated').first()).toHaveText('Unmodified translation');
  await expect(page.locator('.cap-main')).toHaveText('Unmodified translation');
});


