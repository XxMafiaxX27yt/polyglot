// Time-zone helpers built on Intl (no date library).
// Meetings are stored in UTC and shown in the viewer's time zone.

export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function timeZones(include) {
  let list;
  try {
    list = Intl.supportedValuesOf('timeZone');
  } catch {
    list = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Dubai'];
  }
  return [...new Set(['UTC', ...list, ...(include ? [include] : [])])].sort();
}

function partsIn(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Offset of `tz` from UTC at the given instant, in milliseconds. */
function offsetMs(ms, tz) {
  const p = partsIn(ms, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** "2026-11-20" + "15:30" in `tz` → the UTC Date for that wall-clock time. */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const guess = wall - offsetMs(wall, tz);
  return new Date(wall - offsetMs(guess, tz)); // second pass settles DST edges
}

/** UTC ISO string → { date: "YYYY-MM-DD", time: "HH:MM" } as seen in `tz`. */
export function utcToInputs(iso, tz) {
  const p = partsIn(new Date(iso).getTime(), tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const dayKey = (iso, tz) => utcToInputs(iso, tz).date;

const fmt = (iso, tz, options) => new Intl.DateTimeFormat(undefined, { timeZone: tz, ...options }).format(new Date(iso));

export const fmtDate = (iso, tz) => fmt(iso, tz, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (iso, tz) => fmt(iso, tz, { hour: 'numeric', minute: '2-digit' });

export function tzLabel(iso, tz) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? tz;
}

export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
}

/** "in 2 d 3 h", "in 45 min" … for a future instant. */
export function countdown(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim();
  const days = Math.floor(hours / 24);
  return `in ${days} d ${hours % 24 ? `${hours % 24} h` : ''}`.trim();
}

// Calendar day keys ("YYYY-MM-DD") — arithmetic done in UTC so it never drifts.
export const keyToDate = (key) => new Date(`${key}T00:00:00Z`);
export const dateToKey = (date) => date.toISOString().slice(0, 10);
export const addDays = (key, n) => dateToKey(new Date(keyToDate(key).getTime() + n * 86400000));
export const fmtKey = (key, options) => new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', ...options }).format(keyToDate(key));
