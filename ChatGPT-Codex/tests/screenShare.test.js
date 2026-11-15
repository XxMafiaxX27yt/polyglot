import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/hooks/useScreenShare.js', import.meta.url), 'utf8')
  .replace(/^import[^\n]+\n/, '').replaceAll('export function ', 'function ');
const compile = new Function('useState', 'useRef', 'useCallback', 'useEffect', `${source}\nreturn useScreenShare;`);
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
function capture() {
  const listeners = new Set();
  const video = { readyState: 'live', stop() { this.readyState = 'ended'; },
    addEventListener(type, fn) { listeners.add(fn); }, removeEventListener(type, fn) { listeners.delete(fn); } };
  return { video, listeners, getTracks: () => [video], getVideoTracks: () => [video] };
}
function harness(t, getDisplayMedia) {
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getDisplayMedia } } });
  const slots = [];
  let cursor = 0, mounted = false, effect, cleanup;
  const useState = (initial) => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: initial };
    return [slots[index].value, (value) => { slots[index].value = value; }];
  };
  const useRef = (initial) => { const index = cursor++; return slots[index] ??= { current: initial }; };
  const hook = compile(useState, useRef, (fn) => fn, (fn) => { if (!mounted) effect = fn; });
  const render = () => { cursor = 0; const result = hook(); if (!mounted) { mounted = true; cleanup = effect(); } return result; };
  const unmount = () => { cleanup?.(); cleanup = null; };
  t.after(() => { unmount(); if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator; });
  return { render, unmount };
}

test('screen picker completing after unmount releases capture and reports no success', async (t) => {
  const pending = deferred();
  const run = harness(t, () => pending.promise);
  const request = run.render().start();
  run.unmount();
  const fresh = capture(); pending.resolve(fresh);
  assert.equal(await request, false);
  assert.equal(fresh.video.readyState, 'ended');
  assert.equal(fresh.listeners.size, 0);
});

test('newer screen picker wins and old capture listeners are removed', async (t) => {
  const a = deferred(), b = deferred();
  const initial = capture();
  let count = 0;
  const run = harness(t, () => ++count === 1 ? Promise.resolve(initial) : count === 2 ? a.promise : b.promise);
  assert.equal(await run.render().start(), true);
  const oldEnded = [...initial.listeners][0];
  const first = run.render().start(), second = run.render().start();
  const older = capture(), newer = capture();
  b.resolve(newer); assert.equal(await second, true);
  a.resolve(older); assert.equal(await first, false);
  assert.equal(initial.video.readyState, 'ended');
  assert.equal(initial.listeners.size, 0);
  assert.equal(older.video.readyState, 'ended');
  oldEnded(); // an already queued ended callback cannot stop the replacement
  assert.equal(run.render().stream, newer);
  assert.equal(newer.video.readyState, 'live');
  run.unmount();
  assert.equal(newer.listeners.size, 0);
  assert.equal(newer.video.readyState, 'ended');
});

test('stop invalidates a pending picker and browser ended clears the preview', async (t) => {
  const pending = deferred();
  const active = capture();
  let count = 0;
  const run = harness(t, () => ++count === 1 ? pending.promise : Promise.resolve(active));
  const request = run.render().start();
  run.render().stop();
  const stale = capture(); pending.resolve(stale);
  assert.equal(await request, false);
  assert.equal(stale.video.readyState, 'ended');
  assert.equal(await run.render().start(), true);
  [...active.listeners][0]();
  assert.equal(run.render().sharing, false);
  assert.equal(active.listeners.size, 0);
});