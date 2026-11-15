import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleOff, Lock, MonitorUp, Sparkles, Wifi, WifiOff, Zap } from 'lucide-react';
import { BlockDialog, PrivacyStatusDialog, ReportDialog } from './legal/SafetyDialogs.jsx';
import { recordingState } from '../services/recording.js';
import { useScreenShare } from '../hooks/useScreenShare.js';
import Logo from './Logo.jsx';
import VideoTile from './VideoTile.jsx';
import ControlBar from './ControlBar.jsx';
import SidePanel from './SidePanel.jsx';
import { LanguageModal } from './LanguagePicker.jsx';
import VoiceEffects from './VoiceEffects.jsx';
import { getLanguage, isTestedLanguage } from '../data/languages.js';
import { getVoiceMode } from '../data/voiceModes.js';
import { DEMO_PARTICIPANTS, DEMO_SCRIPT } from '../data/demoScript.js';
import { createDemoSession } from '../services/translationService.js';
import { createLiveSession } from '../services/liveSession.js';
import { IS_LIVE, backendHttpUrl } from '../services/backendConfig.js';
import { cancelSpeech, onVoicesChanged, speak, voiceStatus } from '../audio/player.js';

// Voice preferences belong to this listener only: kept in this browser and
// never applied to anyone else's playback.
const VOICE_KEY = 'polyglot.voice';
const SECRET_WORD = 'polyglot';
const SLOW_EFFECT_MS = 250; // an effect slower than this vs Normal is switched off

function loadVoicePrefs() {
  try {
    return { on: false, mode: 'normal', unlocked: false, ...JSON.parse(localStorage.getItem(VOICE_KEY) ?? '{}') };
  } catch {
    return { on: false, mode: 'normal', unlocked: false };
  }
}

const avg = (s) => (s && s.n ? s.sum / s.n : null);

function StreamVideo({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} className="share-video" autoPlay playsInline muted />;
}
import { useMicSpeaking, useOnline } from '../hooks/useLocalMedia.js';

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const initialsOf = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export default function CallRoom({ profile, media, onLeave }) {
  const [listenLang, setListenLang] = useState(profile.lang);
  const [translateOn, setTranslateOn] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [volume, setVolume] = useState(0.9);
  const [panel, setPanel] = useState(() => (window.innerWidth >= 1000 ? 'transcript' : null));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [live, setLive] = useState(null); // utterance currently being spoken
  const [transcript, setTranscript] = useState([]);
  const [detected, setDetected] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [, setVoicesTick] = useState(0);

  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [knownPeople, setKnownPeople] = useState({});
  const [connection, setConnection] = useState('connecting');
  const [coreMode, setCoreMode] = useState('unknown');
  const [error, setError] = useState('');
  const [captureState, setCaptureState] = useState('listening');
  const [playbackBlocked, setPlaybackBlocked] = useState(IS_LIVE);
  const sessionRef = useRef(null);
  const online = useOnline();
  const [audioStarted, setAudioStarted] = useState(null); // id of the utterance whose audio is playing
  const [fullscreen, setFullscreen] = useState(false);
  const callRef = useRef(null);
  const lastVolume = useRef(0.9);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Host controls & screen sharing
  // Demo: whoever opens the room is its host. Live: the role must come from the
  // server-issued token, never from a value the client sets itself.
  const isHost = !IS_LIVE;
  const [people, setPeople] = useState(() =>
    Object.fromEntries(DEMO_PARTICIPANTS.map((p) => [p.id, { muted: false, removed: false, coHost: false }]))
  );
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const [locked, setLocked] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const share = useScreenShare();

  // Privacy & safety
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [safety, setSafety] = useState(null); // { type: 'report' | 'block', person? }
  const [shareRestricted, setShareRestricted] = useState(false);

  // Voice Easter Eggs
  const [voicePrefs] = useState(loadVoicePrefs);
  const [voiceOn, setVoiceOn] = useState(voicePrefs.on);
  const [voiceMode, setVoiceMode] = useState(voicePrefs.mode);
  const [unlocked, setUnlocked] = useState(voicePrefs.unlocked);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [toast, setToast] = useState('');
  const [, setStatsTick] = useState(0);
  const voiceStats = useRef({}); // modeId -> { sum, n } of measured speech-start delays
  const logoClicks = useRef([]);

  const activeMode = getVoiceMode(voiceOn && (unlocked || !getVoiceMode(voiceMode).secret) ? voiceMode : 'normal');

  // The session reads current settings through refs so that changing language,
  // volume or voice mid-call applies from the next utterance without a restart.
  const settings = useRef({ listenLang, translateOn, volume, activeMode });
  settings.current = { listenLang, translateOn, volume, activeMode };

  function recordVoiceStat(modeId, startMs) {
    if (startMs == null) return;
    const stats = voiceStats.current;
    const s = (stats[modeId] ??= { sum: 0, n: 0 });
    s.sum += startMs;
    s.n += 1;
    setStatsTick((n) => n + 1);

    // Real-time comes first: drop an effect that is measurably slowing speech down.
    const base = avg(stats.normal);
    if (modeId !== 'normal' && s.n >= 3 && base != null && avg(s) - base > SLOW_EFFECT_MS) {
      setVoiceMode('normal');
      setVoiceNotice(
        `${getVoiceMode(modeId).label} was starting about ${Math.round(avg(s) - base)} ms later than Normal, so it was switched off to keep the call real-time.`
      );
    }
  }
  const recordRef = useRef(recordVoiceStat);
  recordRef.current = recordVoiceStat;

  function unlockSecret() {
    if (unlocked) return;
    setUnlocked(true);
    setToast('Secret voice unlocked: Deep Space');
  }
  const unlockRef = useRef(unlockSecret);
  unlockRef.current = unlockSecret;

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_KEY, JSON.stringify({ on: voiceOn, mode: voiceMode, unlocked }));
    } catch {
      /* storage unavailable — preferences just won't persist */
    }
  }, [voiceOn, voiceMode, unlocked]);

  // Secret unlock: type "polyglot" anywhere on the meeting screen (not in a text field).
  useEffect(() => {
    let typed = '';
    const onKey = (e) => {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, [contenteditable]')) return;
      typed = (typed + e.key.toLowerCase()).slice(-SECRET_WORD.length);
      if (typed === SECRET_WORD) unlockRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Secret unlock, alternative: click the logo five times quickly.
  function onLogoClick() {
    const now = Date.now();
    logoClicks.current = [...logoClicks.current.filter((t) => now - t < 2500), now];
    if (logoClicks.current.length >= 5) {
      logoClicks.current = [];
      unlockSecret();
    }
  }

  async function previewVoice() {
    if (IS_LIVE) { setVoiceNotice('Live effects apply locally to the next translated WAV. Preview samples use browser voices only in demo mode.'); return; }
    const sample = DEMO_SCRIPT[0].t[listenLang] ?? DEMO_SCRIPT[0].text;
    cancelSpeech();
    const { startMs } = await speak(sample, getLanguage(listenLang).tts, volume || 0.9, activeMode.synth);
    recordVoiceStat(activeMode.id, startMs);
  }

  useEffect(() => {
    if (IS_LIVE && media.status === 'pending') return;
    let active = true;
    const timers = new Set();
    const options = {
      profile, localStream: media.stream,
      getListenLang: () => settings.current.listenLang,
      getTranslateOn: () => settings.current.translateOn,
      getVolume: () => settings.current.volume,
      getVoiceMode: () => settings.current.activeMode,
      canSpeak: (id) => { const person = peopleRef.current[id]; return !!person && !person.muted && !person.removed; },
      onParticipants(list) {
        if (!active) return;
        const peers = list.filter((p) => p.id !== profile.id).map((p, i) => ({ ...p, initials: initialsOf(p.name), hue: (160 + i * 87) % 360 }));
        setRemoteParticipants(peers);
        setKnownPeople((prev) => ({ ...prev, ...Object.fromEntries(peers.map((p) => [p.id, p])) }));
        setPeople((prev) => ({ ...prev, ...Object.fromEntries(peers.map((p) => [p.id, { muted: false, coHost: false }])) }));
      },
      handlers: {
        onStatus(value) { if (active) setConnection(value); },
        onCaptureState(value) { if (active) setCaptureState(value); },
        onError(message) { if (active) setError(message); },
        onPlaybackBlocked(value) { if (active) setPlaybackBlocked(value); },
        onAudioStart({ id }) { if (active) setAudioStarted(id); },
        onUtteranceStart(meta) {
          if (!active) return;
          setLive({ ...meta, original: '', translatedText: '' });
          setDetected((d) => ({ ...d, [meta.speakerId]: { lang: meta.sourceLang, mixed: meta.mixed } }));
        },
        onPartial({ id, original, translated }) {
          if (!active) return;
          setLive((cur) => cur?.id === id ? { ...cur, ...(original !== undefined && { original }), ...(translated !== undefined && { translatedText: translated }) } : cur);
        },
        onUtteranceEnd(entry) {
          if (!active) return;
          setTranscript((entries) => [...entries.slice(-499), entry]);
          setDetected((d) => ({ ...d, [entry.speakerId]: { lang: entry.sourceLang, mixed: entry.mixed } }));
          if (!IS_LIVE && entry.voiceMode) recordRef.current(entry.voiceMode, entry.ttsStartMs);
          setLive({ ...entry, translated: typeof entry.translated === 'string' && entry.translated.length > 0, translatedText: entry.translated ?? '', done: true });
          const timer = setTimeout(() => { timers.delete(timer); if (active) setLive((cur) => cur?.id === entry.id ? null : cur); }, 6000);
          timers.add(timer);
        },
      },
    };
    const session = IS_LIVE ? createLiveSession(options) : createDemoSession(options);
    sessionRef.current = session;
    return () => { active = false; timers.forEach(clearTimeout); session.stop(); if (sessionRef.current === session) sessionRef.current = null; };
  }, [media.stream, media.status, profile.id, profile.room, profile.name]);

  useEffect(() => {
    if (!IS_LIVE) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    Promise.resolve().then(() => fetch(backendHttpUrl('/health'), { signal: controller.signal, cache: 'no-store' }))
      .then((res) => { if (!res.ok) throw new Error('Health unavailable'); return res.json(); })
      .then((health) => { if (!controller.signal.aborted && health.ok === true && typeof health.fake === 'boolean') setCoreMode(health.fake ? 'fake' : 'real'); })
      .catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => onVoicesChanged(() => setVoicesTick((n) => n + 1)), []);

  const lang = getLanguage(listenLang);
  const me = { name: profile.name.trim(), initials: initialsOf(profile.name), avatar: profile.avatar };
  const localSpeaking = useMicSpeaking(media.stream, media.micOn);
  const speakerId = live && !live.done ? live.speakerId : null;

  const avgLatency = useMemo(() => {
    const xs = transcript.filter((e) => e.translated && Number.isFinite(e.latencyMs)).map((e) => e.latencyMs);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }, [transcript]);

  const deviceVoice = !IS_LIVE && translateOn && volume > 0 ? voiceStatus(lang.tts) : 'exact';
  const liveSpeaker = live ? (IS_LIVE ? remoteParticipants : DEMO_PARTICIPANTS).find((p) => p.id === live.speakerId) ?? knownPeople[live.speakerId] : null;

  // Where the current utterance is in the pipeline. Text + icon, never colour alone.
  const speaking = live && !live.done;
  const status = IS_LIVE ? (connection !== 'connected' ? connection : captureState === 'recording' ? 'Recording speech' : speaking ? 'Receiving translation' : captureState === 'processing' ? 'Audio sent · microphone ready' : 'Listening') : !online
    ? 'Reconnecting'
    : !speaking
      ? 'Listening'
      : !live.original
        ? 'Detecting language'
        : !live.translated
          ? 'Playing original audio'
          : deviceVoice === 'none'
            ? 'Translation audio unavailable — captions only'
            : volume === 0
              ? 'Translated audio muted'
              : !live.translatedText
                ? 'Translating'
                : audioStarted !== live.id
                  ? 'Generating voice'
                  : 'Playing translation';

  function toggleMute() {
    if (volume > 0) {
      lastVolume.current = volume;
      setVolume(0);
    } else {
      setVolume(lastVolume.current || 0.9);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else callRef.current?.requestFullscreen?.().catch(() => setToast('Full screen is not available here.'));
  }

  const remotes = IS_LIVE ? remoteParticipants : DEMO_PARTICIPANTS.filter((p) => !people[p.id].removed);

  const patchPerson = (id, patch) => setPeople((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  const silenceIfSpeaking = (id) => {
    if (live?.speakerId === id) cancelSpeech();
  };

  // Host actions. Demo: applied to local state. Live: each one becomes a request
  // to the backend, which checks the caller's role and then calls LiveKit's
  // server API — see docs/HOST_CONTROLS.md.
  const hostActions = {
    setMuted(id, muted) {
      patchPerson(id, { muted });
      if (muted) silenceIfSpeaking(id);
    },
    setCoHost: (id, coHost) => patchPerson(id, { coHost }),
    remove(id) {
      patchPerson(id, { removed: true });
      silenceIfSpeaking(id);
      setToast(`${DEMO_PARTICIPANTS.find((p) => p.id === id)?.name} was removed from the meeting`);
    },
    setLocked(value) {
      setLocked(value);
      setToast(value ? 'Meeting locked' : 'Meeting unlocked');
    },
    stopShare: share.stop,
    setShareRestricted(value) {
      setShareRestricted(value);
      setToast(value ? 'Only hosts can share their screen' : 'Everyone can share their screen');
    },
    endForAll: () => setConfirmEnd(true),
  };

  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(profile.room);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  }

  return (
    <div className="call" ref={callRef}>
      <header className="call-top">
        <div className="call-title">
          <button type="button" className="logo-btn" onClick={onLogoClick} aria-label="Polyglot">
            <Logo size="sm" />
          </button>
          <i className="controls-sep" />
          <div>
            <strong>
              {profile.title ?? `Meeting ${profile.room}`}
              {locked && <Lock size={12} className="lock-icon" aria-label="Locked" />}
            </strong>
            <span role="status" aria-live="polite">
              <i className={`live-dot${speaking ? ' busy' : ''}`} /> {status} · you hear {lang.name}
            </span>
          </div>
        </div>
        <div className="call-meta">
          <button
            type="button"
            className="stat stat-btn"
            onClick={() => setPrivacyOpen(true)}
            title="How AI and your media are being used in this meeting"
          >
            <Sparkles size={14} aria-hidden="true" />
            AI translation {translateOn ? 'on' : 'off'}
          </button>
          <span className="stat" title="No saved meeting recording. Live speech is captured in short segments and sent to the configured backend.">
            <CircleOff size={14} aria-hidden="true" />
            {recordingState().label}
          </span>
          <span className={`stat${online ? '' : ' stat-bad'}`} title="Your browser's network connection">
            {online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            {online ? 'Online' : 'Offline'}
          </span>
          <span className="stat" title={IS_LIVE ? 'Server measured from audio_end received to audio sent; excludes the recording interval. Stub timing is not an AI result.' : 'Simulated time to first translated audio — not a measurement'}>
            <Zap size={14} aria-hidden="true" />
            <b>{avgLatency !== null ? `${(avgLatency / 1000).toFixed(2)}s` : '—'}</b>
            {!IS_LIVE ? 'first audio · simulated' : coreMode === 'real' ? 'server measured' : coreMode === 'fake' ? 'stub timing' : 'core unverified'}
          </span>
          <span className="stat stat-quiet" title={IS_LIVE ? 'Live WebSocket translation; remote tiles are avatars.' : 'Remote participants and translations are scripted. No backend is connected.'}>
            {!IS_LIVE ? 'Demo mode' : coreMode === 'fake' ? 'Live / fake core' : coreMode === 'real' ? 'Live / AI core' : 'Live / core unverified'}
          </span>
          {IS_LIVE && <span className="stat" role="status">{connection}</span>}
        </div>
      </header>

      {error && <div className="session-toast" role="alert"><span>{error}</span><button className="icon-btn" aria-label="Dismiss notification" onClick={() => setError('')}>×</button></div>}
      <div className="call-main">
        <section className="stage">
          {IS_LIVE && <div className="live-notices">
            <p className="live-context">Speak, then pause for translation. Processing may take 7 seconds or longer. Camera and screen previews stay on this device; remote tiles use avatars.</p>
            {connection === 'disconnected' && <p className="notice">Connection closed. Leave and rejoin to reconnect.</p>}
            {connection === 'connected' && remotes.length === 0 && <p className="notice">Invite another listener to room <strong>{profile.room}</strong> to translate between people.</p>}
            {captureState === 'recording' && <p className="translation-progress" role="status">Recording speech — pause when you finish.</p>}
            {captureState === 'processing' && <p className="translation-sent" role="status">Audio sent for translation, which may take several seconds. Your microphone is ready for the next turn; listeners receive the result when the backend finishes.</p>}
            {playbackBlocked && <button className="mbtn" onClick={() => { sessionRef.current?.resumeAudio?.(); }}>Enable translated audio</button>}
            {coreMode === 'fake' && <p className="notice">Fake core: canned text and beep audio. These are not AI evaluation results.</p>}
            {!translateOn && <p className="notice">Showing original captions. Translated audio is muted; this backend does not send original audio.</p>}
          </div>}
          {!isTestedLanguage(listenLang) && <p className="notice">{lang.name} is untested. Translation and voice availability are not verified.</p>}
          <div className={`stage-main${share.sharing ? ' presenting' : ''}`}>
          {share.sharing && (
            <div className="share-view">
              <div className="share-bar">
                <span>
                  <MonitorUp size={16} aria-hidden="true" />
                  <b>{me.name}</b> (You) · local screen preview
                </span>
                <button type="button" className="share-stop" onClick={share.stop}>
                  Stop sharing
                </button>
              </div>
              <StreamVideo stream={share.stream} />
            </div>
          )}
          <div className="tiles">
            {remotes.map((p) => {
              const speaking = speakerId === p.id;
              const d = detected[p.id];
              return (
                <VideoTile
                  key={p.id}
                  name={p.name}
                  initials={p.initials}
                  hue={p.hue}
                  micOn={IS_LIVE ? true : !people[p.id]?.muted}
                  role={!IS_LIVE && people[p.id]?.coHost ? 'Co-host (demo)' : null}
                  speaking={speaking}
                  speakLabel={d ? `${d.mixed ?? getLanguage(d.lang).name} · auto-detected` : null}
                  hearLabel={speaking && live.translated ? `You hear ${getLanguage(live.targetLang).name}` : null}
                />
              );
            })}
            <VideoTile
              name={me.name}
              initials={me.initials}
              avatar={me.avatar}
              hue={24}
              isLocal
              stream={media.stream}
              showVideo={media.hasCam && media.camOn}
              liveMode={IS_LIVE}
          micOn={media.micOn}
              role={isHost ? 'Host' : null}
              speaking={localSpeaking}
            />
          </div>
          </div>

          {share.error && (
            <p className="notice" role="alert">
              {share.error}
            </p>
          )}

          {deviceVoice === 'none' && (
            <p className="notice" role="status">
              This browser has no {lang.name} voice, so demo audio is silent for {lang.name}. Captions still work.
              Microsoft Edge includes voices for more of these languages.
            </p>
          )}
          {deviceVoice === 'fallback' && (
            <p className="notice" role="status">
              This browser has no {lang.name} voice, so the Hindi voice is reading the {lang.name} text. Pronunciation is
              approximate.
            </p>
          )}

          <div className={`captions${captionsOn && live ? ' show' : ''}`} aria-live="polite">
            {captionsOn && live && (
              <>
                <span className="cap-speaker">{liveSpeaker?.name}</span>
                {translateOn && live.translated ? (
                  <>
                    <p className="cap-main" lang={live.targetLang}>
                      {live.translatedText || <span className="cap-wait">Translating…</span>}
                    </p>
                    <p className="cap-sub" lang={live.sourceLang}>
                      {live.original}
                    </p>
                  </>
                ) : (
                  <p className="cap-main" lang={live.sourceLang}>
                    {live.original}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {panel && (
          <SidePanel
            latencyLabel={!IS_LIVE ? 'simulated' : coreMode === 'real' ? 'server measured' : coreMode === 'fake' ? 'stub timing' : 'core unverified'}
            tab={panel}
            onTab={setPanel}
            entries={transcript}
            me={me}
            listenLang={listenLang}
            remotes={remotes}
            allParticipants={IS_LIVE ? Object.values(knownPeople) : DEMO_PARTICIPANTS}
            people={people}
            detected={detected}
            liveMode={IS_LIVE}
          micOn={media.micOn}
            sharing={share.sharing}
            isHost={isHost}
            locked={locked}
            shareRestricted={shareRestricted}
            hostActions={hostActions}
            onReport={(person) => setSafety({ type: 'report', person })}
            onBlock={(person) => setSafety({ type: 'block', person })}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      <ControlBar
        liveMode={IS_LIVE}
        media={media}
        lang={lang}
        translateOn={translateOn}
        onToggleTranslate={() => setTranslateOn((v) => !v)}
        captionsOn={captionsOn}
        onToggleCaptions={() => setCaptionsOn((v) => !v)}
        volume={volume}
        onVolume={setVolume}
        onToggleMute={toggleMute}
        fullscreen={fullscreen}
        onToggleFullscreen={document.fullscreenEnabled ? toggleFullscreen : null}
        room={profile.room}
        elapsed={clock(elapsed)}
        copied={copied}
        onCopyRoom={copyRoom}
        panel={panel}
        onPanel={(tab) => setPanel((cur) => (cur === tab ? null : tab))}
        peopleCount={remotes.length + 1}
        isHost={isHost}
        share={share}
        onOpenLanguages={() => setPickerOpen(true)}
        onLeave={onLeave}
        voiceControl={
          <VoiceEffects
            enabled={voiceOn}
            onEnabled={setVoiceOn}
            mode={voiceMode}
            onMode={(id) => {
              setVoiceMode(id);
              setVoiceNotice('');
            }}
            unlocked={unlocked}
            stats={{ normal: avg(voiceStats.current.normal), selected: avg(voiceStats.current[activeMode.id]) }}
            notice={voiceNotice || (IS_LIVE ? (activeMode.id === 'mystery' ? 'Mystery has no live WAV effect in this prototype. The translated words are unchanged.' : 'Live: the effect changes only this device’s translated audio. Translated words and other listeners are unchanged.') : '')}
            onPreview={previewVoice}
          />
        }
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {confirmEnd && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmEnd(false)}>
          <div
            className="modal confirm"
            role="alertdialog"
            aria-modal="true"
            aria-label="End meeting for everyone"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2>End meeting for everyone?</h2>
            <p>All {remotes.length + 1} participants will be disconnected and the room will close. This can't be undone.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmEnd(false)} autoFocus>
                Cancel
              </button>
              <button className="leave-btn" onClick={onLeave}>
                End for everyone
              </button>
            </div>
          </div>
        </div>
      )}

      {privacyOpen && (
        <PrivacyStatusDialog
          liveMode={IS_LIVE}
          micOn={media.micOn}
          camOn={media.camOn}
          hasMic={media.hasMic}
          hasCam={media.hasCam}
          sharing={share.sharing}
          translateOn={translateOn}
          onClose={() => setPrivacyOpen(false)}
        />
      )}
      {safety?.type === 'report' && (
        <ReportDialog person={safety.person} meetingId={profile.room} onClose={() => setSafety(null)} />
      )}
      {safety?.type === 'block' && (
        <BlockDialog person={safety.person} meetingId={profile.room} onClose={() => setSafety(null)} />
      )}

      {pickerOpen && <LanguageModal value={listenLang} onChange={setListenLang} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}




