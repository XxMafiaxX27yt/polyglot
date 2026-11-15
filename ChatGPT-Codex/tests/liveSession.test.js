import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveSession } from '../src/services/liveSession.js';
function browser(t, options = {}) {
  const keys = ['window', 'WebSocket', 'MediaRecorder', 'MediaStream', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'SpeechSynthesisUtterance'];
  const saved = new Map(keys.map((key) => [key, globalThis[key]]));
  const originalNow = Date.now;
  let now = 1000, sample = 128, interval, cleared = false, lang = options.lang ?? 'hi', translate = true;
  const sockets = [], recorders = [], contexts = [], errors = [], participants = [], statuses = [], events = [], captureStates = [], spoken = [], timeouts = new Map();
  const track = { enabled: true, readyState: 'live', stop() { throw new Error('Must not stop lobby track'); } };
  class Stream { constructor(tracks) { this.tracks = tracks; } getAudioTracks() { return this.tracks; } }
  class Context {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.played = []; contexts.push(this); }
    createGain() { return { connect() {}, disconnect() {}, gain: { setTargetAtTime() {} } }; }
    createAnalyser() { return { fftSize: 512, getByteTimeDomainData(data) { data.fill(sample); }, disconnect() {} }; }
    createMediaStreamSource(stream) { assert.deepEqual(stream.getAudioTracks(), [track]); return { connect() {}, disconnect() {} }; }
    decodeAudioData() { return Promise.resolve({ duration: 1 }); }
    createBufferSource() { const ctx = this; return { connect() {}, disconnect() {}, start(time) { ctx.played.push(time); }, stop() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  class Socket {
    constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
    send(data) { assert.equal(this.readyState, 1); this.sent.push(typeof data === 'string' ? JSON.parse(data) : data); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(message) { this.onmessage?.({ data: typeof message === 'object' && !(message instanceof ArrayBuffer) ? JSON.stringify(message) : message }); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
    constructor(stream, options) { assert.deepEqual(stream.getAudioTracks(), [track]); assert.equal(options.mimeType, 'audio/webm;codecs=opus'); this.state = 'inactive'; recorders.push(this); }
    start() { this.state = 'recording'; }
    chunk() { this.ondataavailable?.({ data: new Blob(['frame']) }); }
    stop() { this.state = 'inactive'; this.chunk(); this.onstop?.(); }
  }
  Object.assign(globalThis, {
    window: { AudioContext: Context, addEventListener() {}, removeEventListener() {} },
    WebSocket: Socket, MediaRecorder: Recorder, MediaStream: Stream,
    setInterval(fn) { interval = fn; return 1; }, clearInterval() { cleared = true; },
  });
  if (options.fakeTimers) {
    let timerId = 0;
    globalThis.setTimeout = (fn, ms) => { timeouts.set(++timerId, { fn, ms }); return timerId; };
    globalThis.clearTimeout = (id) => timeouts.delete(id);
  }
  if (options.browserVoice) {
    globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.speechSynthesis = {
      getVoices: () => [{ lang: 'zh-CN' }],
      speak(utterance) { spoken.push(utterance); utterance.onstart?.(); }, cancel() {},
    };
  }
  Date.now = () => now;
  const session = createLiveSession({ backendUrl: 'http://localhost:8000', profile: { id: 'me', name: 'Me', room: 'PLG-1234' }, localStream: new Stream([track]), getListenLang: () => lang, getTranslateOn: () => translate, getVolume: () => 0.8, onParticipants: (list) => participants.push(list), handlers: { onCaptureState: (s) => captureStates.push(s), onStatus: (s) => statuses.push(s), onError: (s) => errors.push(s), onUtteranceStart: (e) => events.push(e), onUtteranceEnd: (e) => events.push(e) } });
  t.after(() => { session.stop(); Date.now = originalNow; for (const [key, value] of saved) value === undefined ? delete globalThis[key] : globalThis[key] = value; });
  return { session, track, sockets, recorders, contexts, errors, participants, statuses, events, captureStates, spoken, timeouts, runTimeout(ms) { for (const [id, entry] of [...timeouts]) { if (entry.ms === ms) { timeouts.delete(id); entry.fn(); } } }, get cleared() { return cleared; }, setLang(value) { lang = value; }, setTranslate(value) { translate = value; }, tick(ms, level = 128) { now += ms; sample = level; interval?.(); } };
}
test('records all binary chunks before matching audio_end', (t) => {
  const b = browser(t), ws = b.sockets[0];
  ws.open(); b.tick(120, 140); b.recorders[0].chunk(); b.tick(720, 128);
  assert.equal(ws.sent[0].type, 'set_lang');
  const [start, first, last, end] = ws.sent.slice(1);
  assert.equal(start.type, 'audio_start'); assert.ok(first instanceof Blob); assert.ok(last instanceof Blob);
  assert.equal(end.type, 'audio_end'); assert.equal(end.id, start.id); assert.deepEqual(b.errors, []);
});
test('mute ends utterance; stop releases resources and preserves shared tracks', (t) => {
  const b = browser(t), ws = b.sockets[0]; ws.open(); b.tick(120, 140);
  b.track.enabled = false; b.tick(120, 140); b.tick(1000, 140);
  assert.equal(b.recorders.length, 1); assert.equal(ws.sent.at(-1).type, 'audio_end');
  b.session.stop(); b.session.stop(); assert.equal(ws.readyState, 3); assert.equal(b.contexts[0].state, 'closed'); assert.ok(b.cleared);
});
test('syncs lang/participants/errors/status; translated-off still captures microphone', (t) => {
  const b = browser(t), ws = b.sockets[0]; ws.open(); b.setLang('ta'); b.setTranslate(false); b.tick(120, 140);
  assert.ok(ws.sent.some((m) => m.type === 'set_lang' && m.lang === 'ta')); assert.equal(b.recorders.length, 1);
  const list = [{ id: 'you', name: 'You', lang: 'ta' }]; ws.message({ type: 'participants', list }); ws.message({ type: 'error', message: 'Model unavailable' });
  assert.deepEqual(b.participants.at(-1), list); assert.equal(b.errors.at(-1), 'Model unavailable');
  ws.close(); assert.deepEqual(b.statuses, ['connecting', 'connected', 'disconnected']);
});
test('audio header consumes one frame and translation-off discards playback', async (t) => {
  const b = browser(t), ws = b.sockets[0]; ws.open();
  ws.message({ type: 'utterance_start', id: 'a', targetLang: 'hi' }); ws.message({ type: 'audio', id: 'a', format: 'wav' }); ws.message(new ArrayBuffer(12));
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(b.contexts[0].played.length, 1);
  ws.message(new ArrayBuffer(12)); b.setTranslate(false); b.tick(120);
  ws.message({ type: 'audio', id: 'b', format: 'wav' }); ws.message(new ArrayBuffer(12));
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(b.contexts[0].played.length, 1);
});

test('capture state remains sent/processing during model latency without inventing an acknowledgement', (t) => {
  const b = browser(t), ws = b.sockets[0]; ws.open();
  assert.deepEqual(b.captureStates, ['listening']);
  b.tick(120, 140); b.tick(720, 128);
  assert.deepEqual(b.captureStates, ['listening', 'recording', 'processing']);
  b.tick(7000); assert.equal(b.captureStates.at(-1), 'processing');
  b.tick(120, 140); assert.equal(b.captureStates.at(-1), 'recording');
  assert.ok(ws.sent.every((m) => m instanceof Blob || ['set_lang', 'audio_start', 'audio_end'].includes(m.type)));
});

test('browser fallback waits for optional WAV then prevents duplicate late WAV playback', async (t) => {
  const b = browser(t, { lang: 'zh', browserVoice: true, fakeTimers: true }), ws = b.sockets[0]; ws.open();
  const end = { type: 'utterance_end', id: 'zh-1', targetLang: 'zh', original: 'Hello', translated: '你好' };
  ws.message(end); assert.equal(b.spoken.length, 0); b.runTimeout(350);
  assert.equal(b.spoken.length, 1); assert.equal(b.spoken[0].text, '你好');
  ws.message({ type: 'audio', id: 'zh-1', format: 'wav' }); ws.message(new ArrayBuffer(12));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(b.contexts[0].played.length, 0);
  ws.message(end); b.runTimeout(350); assert.equal(b.spoken.length, 1);
});

test('WAV arriving after end cancels pending fallback; language change and stop cancel timers', async (t) => {
  const b = browser(t, { lang: 'zh', browserVoice: true, fakeTimers: true }), ws = b.sockets[0]; ws.open();
  const end = (id) => ({ type: 'utterance_end', id, targetLang: 'zh', translated: '你好' });
  ws.message(end('zh-2')); ws.message({ type: 'audio', id: 'zh-2', format: 'wav' }); ws.message(new ArrayBuffer(12));
  b.runTimeout(350); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(b.spoken.length, 0); assert.equal(b.contexts[0].played.length, 1);
  ws.message(end('zh-3')); b.setLang('en'); b.tick(120); b.runTimeout(350);
  assert.equal(b.spoken.length, 0);
  b.setLang('zh'); b.tick(120); ws.message(end('zh-4')); b.session.stop();
  assert.equal(b.timeouts.size, 0);
});
