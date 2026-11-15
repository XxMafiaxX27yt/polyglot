// Per-browser user preferences (no backend yet, so they live in localStorage).

import { browserTz } from './time.js';

const KEY = 'polyglot.prefs';

const defaults = () => ({
  timeZone: browserTz(),
  lang: 'en', // default listening language
  theme: 'black', // 'black' | 'midnight'
  motion: true, // animated background
  remind: false, // meeting reminders
  micId: null,
  micLabel: null,
  camId: null,
  camLabel: null,
});

export function loadPrefs() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return defaults();
  }
}

export function applyAppearance(prefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.motion = prefs.motion ? 'on' : 'off';
}

export function savePrefs(prefs) {
  applyAppearance(prefs);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — preferences last for this visit only */
  }
}

export function updatePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  savePrefs(next);
  return next;
}
