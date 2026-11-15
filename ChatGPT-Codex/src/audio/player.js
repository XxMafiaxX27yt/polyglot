// Audio playback for translated speech.
//
// Two paths:
//  1. TranslatedAudioQueue — plays encoded audio chunks (mp3/wav/ogg) streamed
//     from the backend TTS, gaplessly, through the Web Audio API.
//  2. speak() — browser speech synthesis, used by demo mode so the UI can be
//     exercised without a backend.

const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
const pendingSpeech = new Set();

// When a device has no voice for a language, a voice for another language that
// shares its script can still read the text aloud (with approximate
// pronunciation). Marathi and Hindi are both written in Devanagari.
const SCRIPT_FALLBACK = { mr: 'hi-IN' };

function findVoice(langTag) {
  if (!hasSynth()) return null;
  const voices = window.speechSynthesis.getVoices();
  const base = langTag.split('-')[0].toLowerCase();
  const norm = (v) => v.lang.replace('_', '-').toLowerCase();
  return (
    voices.find((v) => norm(v) === langTag.toLowerCase()) ||
    voices.find((v) => norm(v).split('-')[0] === base) ||
    null
  );
}

function pickVoice(langTag) {
  const fallback = SCRIPT_FALLBACK[langTag.split('-')[0].toLowerCase()];
  return findVoice(langTag) || (fallback ? findVoice(fallback) : null);
}

/**
 * How this device can voice a language:
 * 'exact' (own voice), 'fallback' (borrowed same-script voice) or 'none'.
 */
export function voiceStatus(langTag) {
  if (findVoice(langTag)) return 'exact';
  return pickVoice(langTag) ? 'fallback' : 'none';
}

/** True when this device can speak the language at all. */
export function hasVoice(langTag) {
  return pickVoice(langTag) !== null;
}

/** Subscribe to the browser's (async) voice list loading. Returns unsubscribe. */
export function onVoicesChanged(cb) {
  if (!hasSynth()) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', cb);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', cb);
}

/**
 * Speak text aloud, optionally in a voice style ({ pitch, rate }).
 * Resolves { played, startMs } where startMs is the measured delay between
 * requesting speech and audio actually starting (null if it never started).
 */
export function speak(text, langTag, volume = 1, style = {}, onStart) {
  return new Promise((resolve) => {
    const voice = pickVoice(langTag);
    if (!hasSynth() || !voice || volume <= 0) return resolve({ played: false, startMs: null });

    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.volume = Math.min(1, Math.max(0, volume));
    u.rate = style.rate ?? 1.05;
    u.pitch = style.pitch ?? 1;

    const requested = performance.now();
    let startMs = null;
    let done = false;
    const finish = (played) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      pendingSpeech.delete(finish);
      resolve({ played, startMs });
    };
    // Some engines never fire `end`; don't let the call stall on them.
    const guard = setTimeout(() => finish(false), 14000);
    pendingSpeech.add(finish);
    u.onstart = () => {
      startMs = Math.round(performance.now() - requested);
      onStart?.();
    };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    try { window.speechSynthesis.speak(u); } catch { finish(false); }
  });
}

export function cancelSpeech() {
  pendingSpeech.forEach((finish) => finish(false));
  if (hasSynth()) window.speechSynthesis.cancel();
}

/**
 * Gapless playback of streamed translated-audio chunks from the backend.
 *
 *   const queue = new TranslatedAudioQueue();
 *   ws.onmessage = (e) => queue.enqueue(e.data); // ArrayBuffer of encoded audio
 *   queue.setVolume(0.8);
 */
export class TranslatedAudioQueue {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio is unavailable in this browser.');
    this.ctx = new Ctx(); this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination);
    this.input = this.ctx.createGain(); this.input.connect(this.gain);
    this.effect = 'none'; this.fxNodes = []; this.startTimers = new Set();
    this.nextStart = 0; this.sources = new Set(); this.generation = 0; this.closed = false; this.pending = Promise.resolve();
  }
  resume() { return this.closed || this.ctx.state !== 'suspended' ? Promise.resolve() : this.ctx.resume(); }
  setVolume(v) {
    if (this.closed) return;
    this.gain.gain.setTargetAtTime(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1, this.ctx.currentTime, 0.02);
  }
  disposeEffect() {
    this.input.disconnect();
    this.fxNodes.forEach((node) => { try { node.stop?.(); } catch { /* not started */ } node.disconnect(); });
    this.fxNodes = [];
  }
  /** Listener-only Web Audio effects. No words, TTS requests or playback pitch change. */
  setVoiceEffect(fx, force = false) {
    if (this.closed) return;
    const effect = ['robot', 'assistant', 'hall'].includes(fx) ? fx : 'none';
    if (effect === this.effect && !force) return;
    this.disposeEffect(); this.effect = effect;
    const ctx = this.ctx, keep = (node) => (this.fxNodes.push(node), node);
    if (effect === 'robot') {
      const ring = keep(ctx.createGain()); ring.gain.value = 0;
      const oscillator = keep(ctx.createOscillator()); oscillator.frequency.value = 55;
      oscillator.connect(ring.gain); oscillator.start();
      this.input.connect(ring); ring.connect(this.gain);
    } else if (effect === 'assistant') {
      const high = keep(ctx.createBiquadFilter()); high.type = 'highpass'; high.frequency.value = 180;
      const delay = keep(ctx.createDelay(0.1)); delay.delayTime.value = 0.018;
      const wet = keep(ctx.createGain()); wet.gain.value = 0.35;
      this.input.connect(high); high.connect(this.gain);
      high.connect(delay); delay.connect(wet); wet.connect(this.gain);
    } else if (effect === 'hall') {
      const low = keep(ctx.createBiquadFilter()); low.type = 'lowshelf'; low.frequency.value = 200; low.gain.value = 6;
      const delay = keep(ctx.createDelay(0.5)); delay.delayTime.value = 0.12;
      const feedback = keep(ctx.createGain()); feedback.gain.value = 0.3;
      const wet = keep(ctx.createGain()); wet.gain.value = 0.25;
      this.input.connect(low); low.connect(this.gain);
      low.connect(delay); delay.connect(wet); wet.connect(this.gain);
      delay.connect(feedback); feedback.connect(delay);
    } else this.input.connect(this.gain);
  }
  scheduleStart(source, startAt, generation, onStart) {
    if (typeof onStart !== 'function') return () => {};
    let timer;
    const poll = () => {
      this.startTimers.delete(timer);
      if (this.closed || generation !== this.generation || !this.sources.has(source)) return;
      const remaining = (startAt - this.ctx.currentTime) * 1000;
      if (remaining > 5 || this.ctx.state === 'suspended') {
        timer = setTimeout(poll, Math.max(20, remaining)); this.startTimers.add(timer);
      } else onStart();
    };
    timer = setTimeout(poll, Math.max(0, (startAt - this.ctx.currentTime) * 1000));
    this.startTimers.add(timer);
    return () => { clearTimeout(timer); this.startTimers.delete(timer); };
  }
  enqueue(arrayBuffer, onStart) {
    const generation = this.generation;
    const task = this.pending.catch(() => {}).then(async () => {
      if (this.closed || generation !== this.generation) return;
      const buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      if (this.closed || generation !== this.generation) return;
      const src = this.ctx.createBufferSource(); src.buffer = buffer; src.connect(this.input);
      const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
      src.start(startAt); this.nextStart = startAt + buffer.duration; this.sources.add(src);
      const cancelStart = this.scheduleStart(src, startAt, generation, onStart);
      src.onended = () => { cancelStart(); this.sources.delete(src); src.disconnect(); };
    });
    this.pending = task; return task;
  }
  flush() {
    this.generation += 1;
    this.startTimers.forEach(clearTimeout); this.startTimers.clear();
    this.sources.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
    this.sources.clear(); this.nextStart = 0;
    // Rebuild delays to remove echo tails when language/translation is changed.
    if (!this.closed) this.setVoiceEffect(this.effect, true);
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.flush(); this.disposeEffect(); this.gain.disconnect();
    void this.ctx.close().catch(() => {});
  }
}


