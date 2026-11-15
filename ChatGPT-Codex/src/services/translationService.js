// Translation session — the seam between the UI and the Polyglot backend.
//
// The call screen only talks to a "session" object through these handlers:
//
//   onUtteranceStart({ id, speakerId, sourceLang, mixed, targetLang, translated })
//   onPartial({ id, original?, translated? })        // streaming captions
//   onUtteranceEnd({ id, speakerId, sourceLang, mixed, targetLang,
//                    original, translated, latencyMs, voiceMode, ttsStartMs })
//
// createDemoSession() below fakes those events from a scripted conversation.
// To go live, write createLiveSession() with the same signature that opens the
// backend WebSocket, forwards events to the same handlers, and feeds audio
// chunks into TranslatedAudioQueue (src/audio/player.js). Nothing in the
// components needs to change.

import { DEMO_SCRIPT } from '../data/demoScript.js';
import { getLanguage } from '../data/languages.js';
import { speak, cancelSpeech } from '../audio/player.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Words for spaced scripts, single characters for Chinese/Japanese.
const tokenize = (text) => (/\s/.test(text.trim()) ? text.split(/(\s+)/) : Array.from(text));

async function streamText(text, durationMs, emit, alive) {
  const parts = tokenize(text);
  const step = durationMs / parts.length;
  let acc = '';
  for (const part of parts) {
    if (!alive()) return;
    acc += part;
    if (part.trim()) {
      emit(acc);
      await sleep(step);
    }
  }
}

export function createDemoSession({ getListenLang, getTranslateOn, getVolume, getVoiceMode, canSpeak, handlers }) {
  let running = true;
  const alive = () => running;
  let seq = 0;

  (async () => {
    await sleep(1400);
    for (let i = 0; running; i++) {
      const line = DEMO_SCRIPT[i % DEMO_SCRIPT.length];
      // Muted or removed participants don't speak.
      if (canSpeak && !canSpeak(line.speakerId)) {
        await sleep(700);
        continue;
      }
      const id = `utt-${++seq}`;
      const listenLang = getListenLang();

      // Same language in and out → pass the original through, no translation.
      const translate = getTranslateOn() && listenLang !== line.lang;
      const heardLang = translate ? listenLang : line.lang;
      const heardText = translate ? line.t[listenLang] : line.text;
      // Simulated time-to-first-translated-audio. Not a measurement.
      const latencyMs = translate ? Math.round(650 + Math.random() * 500) : 0;
      const meta = {
        id,
        speakerId: line.speakerId,
        sourceLang: line.lang,
        mixed: line.mixed ?? null,
        targetLang: heardLang,
        translated: translate,
      };

      handlers.onUtteranceStart(meta);

      const duration = Math.min(3600, 1600 + line.text.length * 28);
      const original = streamText(line.text, duration, (t) => handlers.onPartial({ id, original: t }), alive);

      await sleep(latencyMs);
      if (!running) break;

      // Voice-selection layer: sits between translation and TTS. The translated
      // text is already final here — picking a voice never re-runs translation.
      // Original (untranslated) audio is never restyled.
      const voice = translate ? getVoiceMode?.() : null;
      const audio = speak(heardText, getLanguage(heardLang).tts, getVolume(), voice?.synth, () =>
        handlers.onAudioStart?.({ id })
      );
      const captions = translate
        ? streamText(heardText, duration, (t) => handlers.onPartial({ id, translated: t }), alive)
        : Promise.resolve();

      const [, , spoken] = await Promise.all([original, captions, audio]);
      if (!running) break;

      handlers.onUtteranceEnd({
        ...meta,
        original: line.text,
        translated: translate ? heardText : null,
        latencyMs, // simulated
        voiceMode: voice?.id ?? null,
        ttsStartMs: spoken.startMs, // measured on this device
      });

      await sleep(1700);
    }
  })();

  return {
    stop() {
      running = false;
      cancelSpeech();
    },
  };
}

