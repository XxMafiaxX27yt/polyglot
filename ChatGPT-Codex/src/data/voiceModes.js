// Voice Easter Eggs — themed voices for translated speech.
//
// A voice mode never changes the translated words; it only changes how the
// already-translated text is voiced for THIS listener.
//
//   synth — pitch/rate applied to the browser voice in demo mode.
//   fx    — Web Audio effect applied to backend audio (TranslatedAudioQueue).
//   voice — style id the backend TTS should map to one of its licensed voices.
//
// All styles are original presets. None clones or imitates a real person,
// actor or copyrighted character.

export const VOICE_MODES = [
  {
    id: 'normal',
    label: 'Normal',
    desc: 'Natural, clear and conversational.',
    synth: { pitch: 1, rate: 1.05 },
    fx: 'none',
  },
  {
    id: 'jarvis',
    label: 'J.A.R.V.I.S.',
    desc: 'Calm, articulate AI-assistant style.',
    synth: { pitch: 0.82, rate: 0.98 },
    fx: 'assistant',
  },
  {
    id: 'mystery',
    label: 'Mystery',
    desc: 'Playful, exaggerated cartoon style.',
    synth: { pitch: 1.65, rate: 1.15 },
    fx: 'none',
  },
  {
    id: 'robot',
    label: 'Robot',
    desc: 'Synthetic and slightly mechanical.',
    synth: { pitch: 0.45, rate: 0.9 },
    fx: 'robot',
  },
  {
    id: 'wizard',
    label: 'Wizard',
    desc: 'Dramatic, theatrical narrator.',
    synth: { pitch: 0.62, rate: 0.82 },
    fx: 'hall',
  },
  {
    id: 'cosmic',
    label: 'Deep Space',
    desc: 'Secret: slow, vast and very low.',
    synth: { pitch: 0.2, rate: 0.72 },
    fx: 'hall',
    secret: true,
  },
];

const BY_ID = Object.fromEntries(VOICE_MODES.map((m) => [m.id, m]));

export const getVoiceMode = (id) => BY_ID[id] ?? BY_ID.normal;
