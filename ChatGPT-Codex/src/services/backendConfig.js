// One backend origin drives both HTTP and WebSocket endpoints.
export const BACKEND_URL = (import.meta.env?.VITE_BACKEND_URL ?? '').trim();
export const IS_LIVE = BACKEND_URL.length > 0;

function backendBase(base = BACKEND_URL) {
  if (!base) throw new Error('VITE_BACKEND_URL is not configured.');
  const url = new URL(base);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new Error('VITE_BACKEND_URL must use http, https, ws, or wss.');
  }
  url.protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
  url.search = '';
  url.hash = '';
  return url;
}

export function backendHttpUrl(path, base = BACKEND_URL) {
  return new URL(path, backendBase(base)).href;
}

export function backendWsUrl(profile, base = BACKEND_URL) {
  const url = new URL('/ws', backendBase(base));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({
    room: profile.room,
    user: profile.id,
    name: profile.name,
    lang: profile.lang,
  }).toString();
  return url.href;
}
