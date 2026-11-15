import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Small hook harness lets permission/device races run without browser hardware.
const source = readFileSync(new URL('../src/hooks/useLocalMedia.js', import.meta.url), 'utf8')
  .replace(/^import[^\n]+\n/, '').replaceAll('export function ', 'function ');
const compile = new Function('useState', 'useRef', 'useCallback', 'useEffect', `${source}\nreturn useLocalMedia;`);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const track = (kind, id) => ({ kind, enabled: true, readyState: 'live', getSettings: () => ({ deviceId: id }), stop() { this.readyState = 'ended'; } });
class Stream {
  constructor(tracks) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
}
function harness(t, getUserMedia) {
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldStream = globalThis.MediaStream;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia, enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {},
  } } });
  globalThis.MediaStream = Stream;
  const slots = [];
  let cursor = 0, started = false, effect, cleanup;
  const useState = (initial) => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
    return [slots[index].value, (value) => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
  };
  const useRef = (value) => { const index = cursor++; return slots[index] ??= { current: value }; };
  const hook = compile(useState, useRef, (callback) => callback, (callback) => { if (!started) effect = callback; });
  const render = () => { cursor = 0; const result = hook(); if (!started) { started = true; cleanup = effect(); } return result; };
  const unmount = () => { cleanup?.(); cleanup = null; };
  t.after(() => { unmount(); if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator; globalThis.MediaStream = oldStream; });
  return { render, unmount };
}

test('a pending permission request stops its tracks after unmount', async (t) => {
  const pending = deferred();
  const run = harness(t, () => pending.promise);
  run.render();
  run.unmount();
  const mic = track('audio', 'mic');
  pending.resolve(new Stream([mic]));
  await tick();
  assert.equal(mic.readyState, 'ended');
});

test('failed or empty device acquisition keeps the working microphone', async (t) => {
  const mic = track('audio', 'working');
  let count = 0;
  const run = harness(t, async () => ++count === 1 ? new Stream([mic]) : new Stream([]));
  run.render(); await tick();
  assert.equal(await run.render().switchDevice('mic', 'missing'), false);
  const state = run.render();
  assert.equal(state.selected.micId, 'working');
  assert.equal(mic.readyState, 'live');
  assert.match(state.deviceError, /Could not switch/);
});

test('a newer device selection wins when permission replies arrive out of order', async (t) => {
  const original = track('audio', 'original');
  const a = deferred(), b = deferred();
  let count = 0;
  const run = harness(t, () => ++count === 1 ? Promise.resolve(new Stream([original])) : count === 2 ? a.promise : b.promise);
  run.render(); await tick();
  const state = run.render();
  const first = state.switchDevice('mic', 'a');
  const second = state.switchDevice('mic', 'b');
  const older = track('audio', 'a'), newer = track('audio', 'b');
  b.resolve(new Stream([newer]));
  assert.equal(await second, true);
  a.resolve(new Stream([older]));
  assert.equal(await first, false);
  assert.equal(run.render().selected.micId, 'b');
  assert.equal(older.readyState, 'ended');
  assert.equal(original.readyState, 'ended');
  assert.equal(newer.readyState, 'live');
});

test('switching a muted microphone keeps it muted and preserves the camera', async (t) => {
  const mic = track('audio', 'one'), camera = track('video', 'camera'), replacement = track('audio', 'two');
  let count = 0;
  const run = harness(t, async () => ++count === 1 ? new Stream([mic, camera]) : new Stream([replacement]));
  run.render(); await tick();
  run.render().toggleMic();
  assert.equal(await run.render().switchDevice('mic', 'two'), true);
  const state = run.render();
  assert.equal(replacement.enabled, false);
  assert.equal(state.micOn, false);
  assert.equal(state.selected.camId, 'camera');
  assert.equal(camera.readyState, 'live');
  run.unmount();
  assert.equal(camera.readyState, 'ended');
  assert.equal(replacement.readyState, 'ended');
});

test('a device selection resolving after unmount cannot report success', async (t) => {
  const pending = deferred();
  let count = 0;
  const run = harness(t, () => ++count === 1 ? Promise.resolve(new Stream([track('audio', 'old')])) : pending.promise);
  run.render(); await tick();
  const request = run.render().switchDevice('mic', 'late');
  run.unmount();
  const late = track('audio', 'late');
  pending.resolve(new Stream([late]));
  assert.equal(await request, false);
  assert.equal(late.readyState, 'ended');
});