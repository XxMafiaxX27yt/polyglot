import test from 'node:test';
import assert from 'node:assert/strict';
import { TranslatedAudioQueue, voiceStatus, speak, cancelSpeech } from '../src/audio/player.js';
function setup(t) {
  const previous = globalThis.window;
  const decodes = [], starts = [], stops = [];
  class Context {
    constructor() { this.state = 'running'; this.currentTime = 5; this.destination = {}; }
    createGain() { return { connect() {}, disconnect() {}, gain: { setTargetAtTime() {} } }; }
    decodeAudioData(data) { return new Promise((resolve, reject) => decodes.push({ data, resolve, reject })); }
    createBufferSource() { return { connect() {}, disconnect() {}, start(at) { starts.push(at); }, stop() { stops.push(true); } }; }
    close() { this.state = 'closed'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: Context };
  const queue = new TranslatedAudioQueue();
  t.after(() => { queue.close(); previous === undefined ? delete globalThis.window : globalThis.window = previous; });
  return { queue, decodes, starts, stops };
}
const microtasks = () => new Promise((resolve) => setImmediate(resolve));
test('serializes decoding and schedules chunks in wire order without overlap', async (t) => {
  const { queue, decodes, starts } = setup(t);
  const first = queue.enqueue(new ArrayBuffer(8)), second = queue.enqueue(new ArrayBuffer(9));
  await microtasks(); assert.equal(decodes.length, 1);
  decodes[0].resolve({ duration: 2 }); await first; await microtasks();
  assert.equal(decodes.length, 2); decodes[1].resolve({ duration: 3 }); await second;
  assert.deepEqual(starts, [5.02, 7.02]);
});
test('flush prevents an in-flight decoded chunk from being scheduled', async (t) => {
  const { queue, decodes, starts } = setup(t);
  const chunk = queue.enqueue(new ArrayBuffer(8)); await microtasks();
  queue.flush(); decodes[0].resolve({ duration: 2 }); await chunk; assert.equal(starts.length, 0);
});
test('close prevents pending playback and is idempotent', async (t) => {
  const { queue, decodes, starts } = setup(t);
  const chunk = queue.enqueue(new ArrayBuffer(8)); await microtasks();
  queue.close(); queue.close(); decodes[0].resolve({ duration: 2 }); await chunk;
  assert.equal(starts.length, 0); assert.equal(queue.ctx.state, 'closed');
});
test('one decode failure does not block later valid audio', async (t) => {
  const { queue, decodes, starts } = setup(t);
  const bad = queue.enqueue(new ArrayBuffer(1)); const rejected = assert.rejects(bad, /bad audio/);
  const good = queue.enqueue(new ArrayBuffer(8)); await microtasks();
  decodes[0].reject(new Error('bad audio')); await rejected; await microtasks();
  decodes[1].resolve({ duration: 1 }); await good; assert.equal(starts.length, 1);
});

test('listener effects dispose oscillators/delays on switch, flush and close', (t) => {
  const previous = globalThis.window, nodes = [];
  const node = (kind) => {
    const n = { kind, gain: { setTargetAtTime() {} }, frequency: {}, delayTime: {},
      connect(target) { return target; }, disconnect() { this.disconnected = true; },
      start() { this.running = true; }, stop() { this.running = false; } };
    nodes.push(n); return n;
  };
  class Context {
    constructor() { this.state = 'running'; this.destination = {}; }
    createGain() { return node('gain'); }
    createOscillator() { return node('oscillator'); }
    createBiquadFilter() { return node('filter'); }
    createDelay() { return node('delay'); }
    close() { return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: Context };
  const queue = new TranslatedAudioQueue();
  t.after(() => { queue.close(); globalThis.window = previous; });
  queue.setVoiceEffect('robot');
  const oscillator = nodes.find((n) => n.kind === 'oscillator');
  assert.equal(oscillator.running, true);
  queue.setVoiceEffect('assistant');
  assert.equal(oscillator.running, false); assert.equal(oscillator.disconnected, true);
  const oldDelay = nodes.find((n) => n.kind === 'delay');
  queue.flush(); assert.equal(oldDelay.disconnected, true); assert.equal(queue.effect, 'assistant');
  queue.setVoiceEffect('hall'); queue.close();
  assert.ok(queue.fxNodes.length === 0);
  assert.ok(nodes.filter((n) => n.kind === 'delay').every((n) => n.disconnected));
});

test('browser voice style keeps words intact; borrowed voices are labelled; cancellation settles', async (t) => {
  const previous = globalThis.window, oldUtterance = globalThis.SpeechSynthesisUtterance;
  const spoken = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.window = { speechSynthesis: {
    getVoices: () => [{ lang: 'hi-IN' }], speak: (utterance) => spoken.push(utterance), cancel() {},
  } };
  t.after(() => { cancelSpeech(); globalThis.window = previous;
    oldUtterance === undefined ? delete globalThis.SpeechSynthesisUtterance : globalThis.SpeechSynthesisUtterance = oldUtterance; });
  assert.equal(voiceStatus('hi-IN'), 'exact'); assert.equal(voiceStatus('mr-IN'), 'fallback');
  assert.equal(voiceStatus('ja-JP'), 'none');
  const text = 'अनुवाद बिल्कुल वही है';
  const result = speak(text, 'hi-IN', 0.5, { pitch: 1.65, rate: 1.15 });
  assert.equal(spoken[0].text, text); assert.equal(spoken[0].pitch, 1.65); assert.equal(spoken[0].rate, 1.15);
  spoken[0].onstart(); spoken[0].onend();
  const measured = await result; assert.equal(measured.played, true); assert.ok(Number.isFinite(measured.startMs));
  const canceled = speak(text, 'hi-IN'); cancelSpeech();
  assert.deepEqual(await canceled, { played: false, startMs: null });
});
test('playback start callback waits for audio context time and is canceled on flush', async (t) => {
  const { queue, decodes } = setup(t);
  const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map(); let sequence = 0, started = 0;
  globalThis.setTimeout = (fn) => { timers.set(++sequence, fn); return sequence; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  t.after(() => { globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout; });
  const run = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  const first = queue.enqueue(new ArrayBuffer(8), () => started++);
  await microtasks(); decodes[0].resolve({ duration: 1 }); await first;
  run(); assert.equal(started, 0);
  queue.ctx.currentTime = 5.1; run(); assert.equal(started, 1);
  const second = queue.enqueue(new ArrayBuffer(8), () => started++);
  await microtasks(); decodes[1].resolve({ duration: 1 }); await second;
  assert.equal(timers.size, 1); queue.flush(); assert.equal(timers.size, 0);
  queue.ctx.currentTime = 8; run(); assert.equal(started, 1);
});
