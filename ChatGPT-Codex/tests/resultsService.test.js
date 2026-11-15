import { existsSync, readFileSync } from 'node:fs';
const actualResults = new URL('../../Claude-Claude code/results.json', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { getHinglishProvenance, validateResults, hasMeasurements, loadResults } from '../src/services/resultsService.js';
const response = (data) => ({ ok: true, status: 200, json: async () => data });
test('zero measurements remain reported and unchanged', () => {
  const data = { asr: { hi: { wer: 0, n: 0 } }, mt: { 'en-hi': { nllb: { chrf: 0 }, gemini: { chrf: 0 }, n: 0 } }, hinglish: { baseline: { wer: 0, chrf: 0 }, fix: { wer: 0, chrf: 0 }, n: 0 }, latencyMs: { asr: 0, mt: 0, tts: 0 }, worst: [] };
  assert.equal(validateResults(data), data); assert.equal(hasMeasurements(data), true); assert.equal(hasMeasurements({}), false);
});
test('malformed schema and invalid measurements rejected', () => {
  for (const value of [null, [], 'text', { asr: [] }, { asr: { hi: { wer: '0.2' } } }, { mt: { 'en-hi': { nllb: [] } } }, { latencyMs: { asr: -1 } }, { worst: [{ input: {} }] }]) assert.throws(() => validateResults(value));
});
test('static results loads with explicit source and no fallback notice', async () => {
  const calls = [];
  const loaded = await loadResults({ backendUrl: '', fetchImpl: async (url) => { calls.push(url); return response({ asr: { hi: { wer: 0, n: 2 } } }); } });
  assert.deepEqual(calls, ['/results.json']); assert.equal(loaded.data.asr.hi.wer, 0); assert.equal(loaded.notice, null);
});
test('missing and non-json static results remain unavailable', async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 404 }), async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML'); } })]) await assert.rejects(loadResults({ backendUrl: '', fetchImpl }), /No evaluation results/);
});
test('backend failure falls back to published file with notice', async () => {
  const calls = [];
  const loaded = await loadResults({ backendUrl: 'http://backend.test:8000', fetchImpl: async (url) => { calls.push(url); return url.startsWith('http') ? { ok: false, status: 404 } : response({ latencyMs: { asr: 0 } }); } });
  assert.deepEqual(calls, ['http://backend.test:8000/results', '/results.json']); assert.match(loaded.notice, /published evaluation file/);
});
test('stalled backend times out and falls back', async () => {
  const loaded = await loadResults({ backendUrl: 'http://backend.test', timeoutMs: 10, fetchImpl: (url) => url.startsWith('http') ? new Promise(() => {}) : Promise.resolve(response({})) });
  assert.equal(loaded.source, '/results.json');
});
test('abort cancels load without trying fallback', async () => {
  const controller = new AbortController(); let calls = 0;
  const pending = loadResults({ signal: controller.signal, backendUrl: 'http://backend.test', fetchImpl: () => { calls++; return new Promise(() => {}); } });
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(calls, 1);
});

test('copy baseline and optional speech provenance validate without inventing WER', () => {
  const data = { mt: { 'hi-en': { copy: { chrf: 0 }, nllb: { chrf: 0 }, n: 0 } }, hinglish: { baseline: { wer: null, chrf: 0 }, fix: { wer: null, chrf: 0 }, n: 0, note: 'Computer-made speech, not real speakers.', speech: { human_recordings: 0, computer_recordings: 2, computer_voice: 'Test voice' } } };
  assert.equal(validateResults(data), data);
  assert.equal(data.hinglish.baseline.wer, null);
  assert.equal(data.mt['hi-en'].copy.chrf, 0);
  assert.deepEqual(getHinglishProvenance(data.hinglish), { note: data.hinglish.note, items: ['Human recordings: 0', 'Computer-made recordings: 2', 'Computer voice: Test voice'] });
  assert.deepEqual(getHinglishProvenance(undefined), { note: null, items: [] });
});
test('invalid new metadata is rejected', () => {
  for (const data of [{ mt: { 'hi-en': { copy: { chrf: 'bad' } } } }, { hinglish: { note: {} } }, { hinglish: { speech: { human_recordings: -1 } } }, { hinglish: { speech: { computer_voice: [] } } }, { worst: [{ task: {} }] }, { worst: [{ score: {} }] }, { s2t: { 'hi-en': { route: 'bad' } } }]) assert.throws(() => validateResults(data));
});
test('real Part A artifact loads unchanged with copy baseline and ordered failures', { skip: !existsSync(actualResults) }, async () => {
  const data = JSON.parse(readFileSync(actualResults, 'utf8'));
  const loaded = await loadResults({ backendUrl: '', fetchImpl: async () => response(data) });
  assert.equal(loaded.data, data);
  assert.equal(loaded.source, '/results.json');
  assert.equal(hasMeasurements(data), true);
  for (const row of Object.values(data.mt)) assert.equal(typeof row.copy.chrf, 'number');
  assert.ok(data.worst.slice(0, 5).every((row) => typeof row.task === 'string' && row.score != null));
  assert.equal('hinglish' in loaded.data, 'hinglish' in data);
  assert.ok(Object.keys(data.s2t).length > 0);
});
