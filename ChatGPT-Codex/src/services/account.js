// Account + profile — the seam between the UI and the authentication backend.
//
// PROTOTYPE: there is no authentication backend. "Signing in" only remembers
// an email address in this browser; no password is checked, sent or stored.
// Replace these functions with real API calls (see docs/API_INTEGRATION.md).
// Until then nothing here is security.

const SESSION_KEY = 'polyglot.session'; // { email }
const PROFILES_KEY = 'polyglot.profiles'; // { [email]: { name, avatar } }

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
    return false; // storage full or blocked
  }
};

const toUser = (email) => ({ email, name: '', avatar: null, ...read(PROFILES_KEY, {})[email] });

/** The remembered user, or null. */
export function loadUser() {
  const session = read(SESSION_KEY, null);
  return session?.email ? toUser(session.email) : null;
}

export function signIn(email, suggestedName) {
  const profiles = read(PROFILES_KEY, {});
  if (!profiles[email]) {
    profiles[email] = { name: suggestedName, avatar: null };
    write(PROFILES_KEY, profiles);
  }
  write(SESSION_KEY, { email, at: new Date().toISOString() });
  return toUser(email);
}

/** When this browser session was started (prototype: no server-side session exists). */
export const sessionStartedAt = () => read(SESSION_KEY, null)?.at ?? null;

export function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* Still leave the in-memory session. */ }
}

/** Returns the updated user, or null if the change could not be saved. */
export function updateProfile(email, patch) {
  const profiles = read(PROFILES_KEY, {});
  profiles[email] = { ...profiles[email], ...patch };
  return write(PROFILES_KEY, profiles) ? toUser(email) : null;
}

/** Shrink an uploaded picture to a small square JPEG data URL. */
export function resizeAvatar(file, size = 160) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('That image is larger than 8 MB.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas
        .getContext('2d')
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

