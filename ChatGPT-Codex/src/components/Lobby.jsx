import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Mic, MicOff, ScanSearch, Sparkles, Video, VideoOff } from 'lucide-react';
import Logo from './Logo.jsx';
import LiquidGlass from './LiquidGlass.jsx';
import { LanguageGrid } from './LanguagePicker.jsx';
import { getLanguage } from '../data/languages.js';
import { IS_LIVE } from '../services/backendConfig.js';
import { useMicLevel } from '../hooks/useLocalMedia.js';
import { updatePrefs } from '../utils/prefs.js';

const initialsOf = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'You';

export default function Lobby({ profile, onChange, media, onJoin, onExit, onResults }) {
  const videoRef = useRef(null);
  const showVideo = media.stream && media.hasCam && media.camOn;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream;
  }, [media.stream, showVideo]);

  const level = useMicLevel(media.stream, media.micOn);

  // Switch device and remember it as the default for next time.
  async function pickDevice(kind, deviceId) {
    if (!(await media.switchDevice(kind, deviceId))) return;
    const list = kind === 'mic' ? media.devices.mics : media.devices.cams;
    const label = list.find((d) => d.deviceId === deviceId)?.label ?? null;
    updatePrefs(kind === 'mic' ? { micId: deviceId, micLabel: label } : { camId: deviceId, camLabel: label });
  }

  const lang = getLanguage(profile.lang);
  const canJoin = profile.name.trim().length > 0 && profile.room.trim().length > 0;

  return (
    <div className="lobby">
      <header className="lobby-nav">
        <Logo />
        <nav aria-label="Session navigation">
          <button className="btn-ghost" onClick={onResults}>Results</button>
          <button className="btn-ghost" onClick={onExit}>
          <ArrowLeft size={16} aria-hidden="true" />
          Dashboard
          </button>
        </nav>
      </header>

      <main className="lobby-main">
        <section className="hero">
          <p className="eyebrow">{IS_LIVE ? 'Live backend · voice translation' : 'Demo mode · simulated conversation'}</p>
          <h1>
            Speak your language.
            <br />
            <span>Hear theirs.</span>
          </h1>
          <p className="hero-sub">
            {IS_LIVE ? 'Join the same room in two browser tabs or devices. Speak, pause, and hear a translation. Your camera is a local preview; remote people appear as avatars.' : 'Explore a scripted conversation with simulated translations and latency. Your microphone is not sent to a backend in demo mode.'}
          </p>
          <ul className="hero-points">
            <li>
              <AudioLines size={18} aria-hidden="true" />
              <div>
                <strong>4 languages in the tested scope</strong>
                <span>Hindi, English, Tamil, Bengali, plus Hinglish. Other languages are untested.</span>
              </div>
            </li>
            <li>
              <ScanSearch size={18} aria-hidden="true" />
              <div>
                <strong>Choose the language you speak</strong>
                <span>Your choice helps speech recognition. Hinglish speakers choose Hindi.</span>
              </div>
            </li>
          </ul>
        </section>

        <LiquidGlass className="join-card">
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canJoin) onJoin();
          }}
        >
          <div className="preview">
            {showVideo ? (
              <video ref={videoRef} className="mirrored" autoPlay playsInline muted />
            ) : (
              <div className="preview-off">
                <div className="tile-avatar">
                  {profile.avatar ? <img src={profile.avatar} alt="" /> : initialsOf(profile.name)}
                </div>
                <p>
                  {media.status === 'pending' && 'Waiting for camera and microphone…'}
                  {media.status === 'blocked' && 'Camera and microphone are unavailable. You can still join to listen.'}
                  {media.status === 'ready' && 'Camera is off'}
                </p>
              </div>
            )}
            <div className="preview-controls">
              <button
                type="button"
                className={`round-btn${media.micOn ? '' : ' off'}`}
                onClick={media.toggleMic}
                disabled={!media.hasMic}
                aria-label={media.micOn ? 'Mute microphone' : 'Unmute microphone'}
                aria-pressed={!media.micOn}
              >
                {media.micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button
                type="button"
                className={`round-btn${media.camOn ? '' : ' off'}`}
                onClick={media.toggleCam}
                disabled={!media.hasCam}
                aria-label={media.camOn ? 'Turn camera off' : 'Turn camera on'}
                aria-pressed={!media.camOn}
              >
                {media.camOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            </div>
          </div>

          <div className="mic-test" role="group" aria-label="Microphone test">
            {media.micOn ? <Mic size={15} aria-hidden="true" /> : <MicOff size={15} aria-hidden="true" />}
            <div className="mic-meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
              <i style={{ width: `${level * 100}%` }} />
            </div>
            <span>
              {!media.hasMic
                ? 'No microphone'
                : !media.micOn
                  ? 'Muted'
                  : level > 0.15
                    ? 'Picking up your voice'
                    : 'Say something to test'}
            </span>
          </div>

          {(media.devices.mics.length > 0 || media.devices.cams.length > 0) && (
            <div className="field-row even">
              {media.devices.mics.length > 0 && (
                <label className="field">
                  <span>Microphone</span>
                  <select value={media.selected.micId ?? ''} onChange={(e) => pickDevice('mic', e.target.value)}>
                    {media.devices.mics.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {media.devices.cams.length > 0 && (
                <label className="field">
                  <span>Camera</span>
                  <select value={media.selected.camId ?? ''} onChange={(e) => pickDevice('cam', e.target.value)}>
                    {media.devices.cams.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {media.deviceError && (
            <p className="notice" role="alert">
              {media.deviceError}
            </p>
          )}

          <div className="field-row">
            <label className="field">
              <span>Your name</span>
              <input
                value={profile.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g. Priya"
                maxLength={32}
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span>{profile.title ? 'Meeting ID' : 'Room code'}</span>
              <input
                value={profile.room}
                onChange={(e) => onChange({ room: e.target.value.toUpperCase() })}
                
                maxLength={16}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="field">
            <span>
              I speak / want to hear{' '}
              <b className="accent" lang={lang.code}>
                {lang.name === lang.native ? lang.name : `${lang.name} · ${lang.native}`}
              </b>
            </span>
            <LanguageGrid value={profile.lang} onChange={(code) => onChange({ lang: code })} />
          </div>

          <p className="ai-note">
            <Sparkles size={15} aria-hidden="true" />
            <span>
              {IS_LIVE ? 'Short speech recordings are sent to the configured backend for AI transcription, translation and synthetic speech. Translations can be wrong. Speech recordings are sent only after you join; processing may take several seconds.' : 'Demo mode uses a scripted conversation and simulated timings. No microphone audio is sent to a backend.'} <a href="#/legal/ai">AI Transparency Notice</a>
            </span>
          </p>

          <button className="btn-primary" type="submit" disabled={!canJoin}>
            {IS_LIVE ? 'Join live room' : 'Join demo'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {!canJoin && <p className="hint">Enter your name to join.</p>}
        </form>
        </LiquidGlass>
      </main>
    </div>
  );
}
