// Consent, cookie choices, privacy requests, safety reports and sessions.
//
// Two kinds of function live here:
//   * LOCAL  — real today. They act on data held in this browser.
//   * SERVER — go through api.js and fail honestly until a backend exists.
// Nothing in this file ever reports success that did not happen.

import { POLICY_VERSION } from '../legal/config.js';
import { api } from './api.js';

const CONSENT_KEY = 'polyglot.consents'; // { [email]: [{ type, granted, version, at, detail? }] }
const COOKIE_KEY = 'polyglot.cookies'; // { analytics, advertising, version, at }
const REGION_KEY = 'polyglot.region';

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/* ---------- Consent (LOCAL record; the backend must keep the authoritative one) ---------- */

export const REQUIRED_CONSENTS = ['terms', 'age', 'ai'];
export const CONSENT_LABELS = {
  terms: 'Terms of Service and Privacy Policy',
  age: 'Age eligibility',
  ai: 'AI processing of meeting speech',
  marketing: 'Product update emails',
  analytics: 'Analytics',
};

export const consentHistory = (email) => read(CONSENT_KEY, {})[email] ?? [];

/** Latest decision for one consent type, or undefined. */
export function latestConsent(email, type) {
  return consentHistory(email).findLast((c) => c.type === type);
}

/** True when every required consent was given for the CURRENT policy version. */
export function hasRequiredConsent(email) {
  return REQUIRED_CONSENTS.every((type) => {
    const c = latestConsent(email, type);
    return c?.granted && c.version === POLICY_VERSION;
  });
}

/** Append consent decisions. Returns false if they could not be saved. */
export function recordConsent(email, decisions) {
  const all = read(CONSENT_KEY, {});
  const at = new Date().toISOString();
  all[email] = [...(all[email] ?? []), ...decisions.map((d) => ({ ...d, version: POLICY_VERSION, at }))];
  return write(CONSENT_KEY, all);
}

/* ---------- Cookie / analytics choice (LOCAL) ---------- */

/** null until the visitor has chosen. */
export const getCookiePrefs = () => read(COOKIE_KEY, null);

export function setCookiePrefs({ analytics }) {
  // Advertising is not used; stored explicitly so a future feature starts from "off".
  const prefs = { analytics: !!analytics, advertising: false, version: POLICY_VERSION, at: new Date().toISOString() };
  write(COOKIE_KEY, prefs);
  window.dispatchEvent(new Event('polyglot:cookies-changed'));
  return prefs;
}

/**
 * Gate for any optional script. Nothing calls this yet because no analytics
 * tool is installed — load one only inside `if (analyticsAllowed())`.
 */
export const analyticsAllowed = () => getCookiePrefs()?.analytics === true;

export const openCookieChoices = () => window.dispatchEvent(new Event('polyglot:cookies-open'));

/* ---------- Region (LOCAL) ---------- */

export const getRegionId = () => read(REGION_KEY, 'in');
export const setRegionId = (id) => write(REGION_KEY, id);

/* ---------- Data held in this browser (LOCAL, real) ---------- */

const ownKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('polyglot.'));

/** Everything Polyglot has stored in this browser, as a plain object. */
export function collectLocalData() {
  const data = {};
  for (const key of ownKeys()) data[key] = read(key, null);
  return { exportedAt: new Date().toISOString(), source: 'This browser only — Polyglot has no server copy.', data };
}

export function downloadLocalData() {
  const blob = new Blob([JSON.stringify(collectLocalData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'polyglot-my-data.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Removes everything Polyglot stored in this browser. Returns true only if nothing is left. */
export function eraseLocalData() {
  for (const key of ownKeys()) localStorage.removeItem(key);
  for (const key of Object.keys(sessionStorage)) if (key.startsWith('polyglot.')) sessionStorage.removeItem(key);
  window.dispatchEvent(new Event('polyglot:cookies-changed')); // the cookie choice is gone too: ask again
  return ownKeys().length === 0;
}

/* ---------- SERVER: privacy requests, reports, support, sessions ---------- */
// Proposed endpoints — to be agreed with the backend team.

/** kind: 'export' | 'delete-data' | 'delete-account' */
export const submitPrivacyRequest = (kind, detail) => api('/privacy/requests', { method: 'POST', body: { kind, detail } });
export const listPrivacyRequests = () => api('/privacy/requests');

/** Private to the safety team: never shown to other participants. */
export const submitReport = (report) => api('/safety/reports', { method: 'POST', body: report });
export const blockParticipant = (meetingId, participantId) =>
  api(`/meetings/${encodeURIComponent(meetingId)}/participants/${encodeURIComponent(participantId)}/block`, { method: 'POST' });

export const submitSupportRequest = (request) => api('/support/requests', { method: 'POST', body: request });

export const listSessions = () => api('/auth/sessions');
export const signOutOtherSessions = () => api('/auth/sessions/others', { method: 'DELETE' });
