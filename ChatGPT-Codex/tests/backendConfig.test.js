import test from 'node:test';
import assert from 'node:assert/strict';
import { backendHttpUrl, backendWsUrl } from '../src/services/backendConfig.js';

test('HTTP endpoints accept HTTP or WebSocket backend origins', () => {
  assert.equal(backendHttpUrl('/results', 'http://localhost:8000/'), 'http://localhost:8000/results');
  assert.equal(backendHttpUrl('/health', 'wss://example.org/ws?old=1'), 'https://example.org/health');
});

test('WebSocket endpoint preserves contract query fields and escapes names', () => {
  const url = new URL(backendWsUrl({ id: 'u-1', room: 'PLG-1234', name: 'A & B', lang: 'ta' }, 'https://example.org'));
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.pathname, '/ws');
  assert.deepEqual(Object.fromEntries(url.searchParams), { room: 'PLG-1234', user: 'u-1', name: 'A & B', lang: 'ta' });
});

test('bad or absent backend configuration gives an actionable error', () => {
  assert.throws(() => backendHttpUrl('/health', ''), /not configured/);
  assert.throws(() => backendHttpUrl('/health', 'file:///etc'), /must use/);
});
