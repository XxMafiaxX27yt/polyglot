import { useRef, useState } from 'react';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import { LANGUAGES, isTestedLanguage } from '../../data/languages.js';
import { VOICE_MODES } from '../../data/voiceModes.js';
import { resizeAvatar } from '../../services/account.js';
import { browserTz, timeZones } from '../../utils/time.js';

const VOICE_KEY = 'polyglot.voice'; // shared with the in-meeting Voice effects popup

function loadVoice() {
  try {
    return { on: false, mode: 'normal', unlocked: false, ...JSON.parse(localStorage.getItem(VOICE_KEY) ?? '{}') };
  } catch {
    return { on: false, mode: 'normal', unlocked: false };
  }
}

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

/** Central settings: profile, translation, voice, devices, notifications, appearance, account. */
export default function SettingsView({ user, onUpdateUser, prefs, setPrefs, onSignOut, notify }) {
  const [name, setName] = useState(user.name);
  const [voice, setVoice] = useState(loadVoice);
  const fileRef = useRef(null);
  const tz = prefs.timeZone;
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  function saveVoice(patch) {
    const next = { ...voice, ...patch };
    setVoice(next);
    try {
      localStorage.setItem(VOICE_KEY, JSON.stringify(next));
    } catch {
      notify('Voice preference could not be saved in this browser.');
    }
  }

  function saveName(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return notify('Display name cannot be empty.');
    notify(onUpdateUser({ name: trimmed }) ? 'Display name updated' : 'Could not save your name.');
  }

  async function pickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const avatar = await resizeAvatar(file);
      notify(onUpdateUser({ avatar }) ? 'Profile picture updated' : 'Could not save that picture.');
    } catch (err) {
      notify(err.message);
    }
  }

  async function toggleReminders(on) {
    if (!on) return set({ remind: false });
    if (!('Notification' in window)) return notify('This browser does not support notifications.');
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return notify('Notifications are blocked for this site in your browser settings.');
    set({ remind: true });
  }

  const modes = VOICE_MODES.filter((m) => !m.secret || voice.unlocked);

  return (
    <>
      <header className="dash-head">
        <h1>Settings</h1>
        <p>Saved in this browser.</p>
      </header>

      <div className="settings">
        <section className="set-card">
          <h2>Profile</h2>
          <div className="set-profile">
            <span className="set-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : (user.name[0] ?? '?').toUpperCase()}</span>
            <div className="set-avatar-actions">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
              <button type="button" className="mbtn" onClick={() => fileRef.current.click()}>
                <Camera size={14} aria-hidden="true" />
                {user.avatar ? 'Change picture' : 'Upload picture'}
              </button>
              {user.avatar && (
                <button type="button" className="mbtn" onClick={() => notify(onUpdateUser({ avatar: null }) ? 'Profile picture removed' : 'Could not remove the picture.')}>
                  <Trash2 size={14} aria-hidden="true" />
                  Remove
                </button>
              )}
              <em className="help">Shown on your tile in meetings when your camera is off.</em>
            </div>
          </div>
          <form className="set-inline" onSubmit={saveName}>
            <label className="field">
              <span>Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoComplete="name" />
            </label>
            <button className="mbtn primary" type="submit" disabled={name.trim() === user.name || !name.trim()}>
              Save
            </button>
          </form>
          <label className="field">
            <span>Email</span>
            <input value={user.guest ? 'No email needed for guest access' : user.email} readOnly />
          </label>
        </section>

        <section className="set-card">
          <h2>Translation</h2>
          <label className="field">
            <span>Default speaking and listening language</span>
            <select value={prefs.lang} onChange={(e) => set({ lang: e.target.value })}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name === l.native ? l.name : `${l.name} · ${l.native}`}{!isTestedLanguage(l.code) && ' · Untested'}
                </option>
              ))}
            </select>
            <em className="help">Pre-selected when you join a call. You can still change it in the meeting.</em>
          </label>
          <div className="set-row">
            <div>
              <strong>Enable themed voices</strong>
              <span>Optional. Only changes what you hear; the natural voice stays the default.</span>
            </div>
            <Switch checked={voice.on} onChange={(on) => saveVoice({ on })} label="Enable themed voices" />
          </div>
          <label className="field">
            <span>Preferred AI voice</span>
            <select value={voice.mode} disabled={!voice.on} onChange={(e) => saveVoice({ mode: e.target.value })}>
              {modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
            <em className="help">
              Demo: styles change the pitch and speed of your browser voice. If your browser has no voice for a language,
              the meeting says so and falls back to captions.
            </em>
          </label>
        </section>

        <section className="set-card">
          <h2>Devices</h2>
          <dl className="set-list">
            <div>
              <dt>Default microphone</dt>
              <dd>{prefs.micLabel ?? 'System default'}</dd>
            </div>
            <div>
              <dt>Default camera</dt>
              <dd>{prefs.camLabel ?? 'System default'}</dd>
            </div>
          </dl>
          <div className="set-actions">
            <em className="help">Choose devices on the pre-join screen; your choice is remembered here.</em>
            {(prefs.micId || prefs.camId) && (
              <button type="button" className="mbtn" onClick={() => set({ micId: null, micLabel: null, camId: null, camLabel: null })}>
                Reset to system default
              </button>
            )}
          </div>
        </section>

        <section className="set-card">
          <h2>Date and notifications</h2>
          <label className="field">
            <span>Time zone</span>
            <select value={tz} onChange={(e) => set({ timeZone: e.target.value })}>
              {timeZones(tz).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <em className="help">Detected automatically: {browserTz().replace(/_/g, ' ')}. Meeting times are shown in this zone.</em>
          </label>
          <div className="set-row">
            <div>
              <strong>Meeting reminders</strong>
              <span>A browser notification 10 minutes before a meeting. Only works while Polyglot is open.</span>
            </div>
            <Switch checked={prefs.remind} onChange={toggleReminders} label="Meeting reminders" />
          </div>
        </section>

        <section className="set-card">
          <h2>Appearance</h2>
          <div className="set-themes" role="radiogroup" aria-label="Theme">
            {[
              ['black', 'Black', '#070707', '#ff6b00'],
              ['midnight', 'Midnight', '#171923', '#ff7a1a'],
            ].map(([id, label, bg, accent]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.theme === id} className={`set-theme${prefs.theme === id ? ' selected' : ''}`} onClick={() => set({ theme: id })}>
                <span className="swatch" style={{ background: bg }}>
                  <i style={{ background: accent }} />
                </span>
                {label}
              </button>
            ))}
          </div>
          <div className="set-row">
            <div>
              <strong>Animated background</strong>
              <span>Turn off the moving waves if you prefer a still page.</span>
            </div>
            <Switch checked={prefs.motion} onChange={(motion) => set({ motion })} label="Animated background" />
          </div>
        </section>

        <section className="set-card">
          <h2>Account</h2>
          <p className="help">
            {user.guest ? 'Guest session: no account or password is required. Profile changes last for this app visit.' : 'Prototype sign-in: this browser remembers a local profile; no account server checks a password.'}
          </p>
          <button type="button" className="mbtn" onClick={onSignOut}>
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
          <p className="help">
            <a href="#/legal">Legal &amp; Privacy policies</a> · <a href="#/help">Help &amp; Privacy Support</a>. Manage your
            data and consent under Privacy &amp; Security in the sidebar.
          </p>
        </section>
      </div>
    </>
  );
}



