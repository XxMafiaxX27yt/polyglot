// Scheduled meetings — the seam between the dashboard and the backend.
//
// PROTOTYPE STORAGE: meetings live in this browser's localStorage. They are
// not shared between devices, invitation links only resolve in the browser
// that created them, and the host checks below are NOT security — anyone can
// edit localStorage. To go live, keep these function names and replace their
// bodies with calls to the API in docs/SCHEDULING.md; the server must then do
// every permission and date check itself.
//
// Scheduling never opens a call. A room is only created when someone joins.

import { fmtDate, fmtTime, tzLabel } from '../utils/time.js';

const KEY = 'polyglot.meetings';
const JOIN_EARLY_MS = 10 * 60 * 1000; // room opens 10 minutes before the start

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};
const write = (list) => localStorage.setItem(KEY, JSON.stringify(list));

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/** 144 bits from the platform CSPRNG, URL-safe. */
const newToken = () =>
  btoa(String.fromCharCode(...randomBytes(18)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
function newId(existing) {
  for (;;) {
    const s = [...randomBytes(8)].map((b) => ID_CHARS[b % 32]).join('');
    const id = `PLG-${s.slice(0, 4)}-${s.slice(4)}`;
    if (!existing.some((m) => m.id === id)) return id;
  }
}

export class MeetingError extends Error {}

const isHost = (meeting, user) => meeting.hostId === user.email;

function requireHost(meeting, user) {
  if (!meeting) throw new MeetingError('That meeting no longer exists.');
  if (!isHost(meeting, user)) throw new MeetingError('Only the host can change this meeting.');
}

function validate(data) {
  if (!data.title?.trim()) throw new MeetingError('Give the meeting a title.');
  const start = new Date(data.scheduledStartUtc).getTime();
  if (!Number.isFinite(start)) throw new MeetingError('Pick a valid date and time.');
  if (start <= Date.now()) throw new MeetingError('That time has already passed.');
  if (!(data.durationMinutes > 0)) throw new MeetingError('Pick a duration.');
}

/** Meetings this user hosts or is invited to. */
export function listMeetings(user) {
  return read().filter((m) => isHost(m, user) || m.invited.includes(user.email));
}

export const getMeeting = (id) => read().find((m) => m.id === id) ?? null;

/** Look up by meeting ID, invitation token, or a pasted invitation link. */
export function findMeeting(input) {
  const text = input.trim();
  const token = text.includes('join=') ? text.split('join=')[1].split(/[&#\s]/)[0] : text;
  return read().find((m) => m.invitationToken === token || m.id === text.toUpperCase()) ?? null;
}

export function createMeeting(data, user) {
  validate(data);
  const list = read();
  const now = new Date().toISOString();
  const meeting = {
    id: newId(list),
    title: data.title.trim(),
    description: data.description?.trim() ?? '',
    hostId: user.email,
    hostName: user.name,
    scheduledStartUtc: data.scheduledStartUtc,
    durationMinutes: data.durationMinutes,
    timezone: data.timezone,
    invited: data.invited ?? [],
    passcode: data.passcode || null, // prototype only — a real backend stores a hash
    status: 'scheduled',
    invitationToken: newToken(),
    createdAt: now,
    updatedAt: now,
  };
  write([...list, meeting]);
  return meeting;
}

/** Edits the same record, so the existing invitation link always shows the latest details. */
export function updateMeeting(id, data, user) {
  const list = read();
  const meeting = list.find((m) => m.id === id);
  requireHost(meeting, user);
  if (meeting.status === 'cancelled') throw new MeetingError('A cancelled meeting cannot be edited.');
  validate(data);
  Object.assign(meeting, {
    title: data.title.trim(),
    description: data.description?.trim() ?? '',
    scheduledStartUtc: data.scheduledStartUtc,
    durationMinutes: data.durationMinutes,
    timezone: data.timezone,
    invited: data.invited ?? [],
    passcode: data.passcode || null,
    updatedAt: new Date().toISOString(),
  });
  write(list);
  return meeting;
}

/** Keeps the record (status "cancelled") so its link explains what happened instead of breaking. */
export function cancelMeeting(id, user) {
  const list = read();
  const meeting = list.find((m) => m.id === id);
  requireHost(meeting, user);
  meeting.status = 'cancelled';
  meeting.updatedAt = new Date().toISOString();
  write(list);
  return meeting;
}

const endOf = (m) => new Date(m.scheduledStartUtc).getTime() + m.durationMinutes * 60000;

/**
 * scheduled | live | completed | cancelled.
 * Prototype: "live" and "completed" are worked out from the clock. A real
 * backend sets them from what actually happened in the room.
 */
export function statusOf(meeting, now = Date.now()) {
  if (meeting.status === 'cancelled') return 'cancelled';
  if (now >= endOf(meeting)) return 'completed';
  if (now >= new Date(meeting.scheduledStartUtc).getTime()) return 'live';
  return 'scheduled';
}

export const startsInMs = (meeting, now = Date.now()) => new Date(meeting.scheduledStartUtc).getTime() - now;

export function joinState(meeting, now = Date.now()) {
  const status = statusOf(meeting, now);
  if (status === 'cancelled') return { ok: false, reason: 'This meeting was cancelled.' };
  if (status === 'completed') return { ok: false, reason: 'This meeting has ended.' };
  if (startsInMs(meeting, now) > JOIN_EARLY_MS) return { ok: false, reason: 'You can join 10 minutes before it starts.' };
  return { ok: true };
}

export const hostsMeeting = isHost;

export const inviteLink = (meeting) => `${window.location.origin}/?join=${meeting.invitationToken}`;

export function invitationText(meeting, tz) {
  return [
    `You're invited to a Polyglot meeting`,
    ``,
    `${meeting.title}`,
    `When: ${fmtDate(meeting.scheduledStartUtc, tz)}, ${fmtTime(meeting.scheduledStartUtc, tz)} (${tzLabel(meeting.scheduledStartUtc, tz)})`,
    `Time zone: ${tz}`,
    `Host: ${meeting.hostName}`,
    `Meeting ID: ${meeting.id}`,
    ...(meeting.passcode ? [`A passcode is required — ask the host for it.`] : []),
    ``,
    `Join: ${inviteLink(meeting)}`,
    ``,
    `Speak your language. Hear theirs.`,
  ].join('\n');
}
