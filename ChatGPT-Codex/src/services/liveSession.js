import { TranslatedAudioQueue, speak, hasVoice, cancelSpeech } from '../audio/player.js';
import { getLanguage } from '../data/languages.js';
import { backendWsUrl, BACKEND_URL } from './backendConfig.js';

/** Part B protocol. Lobby owns the stream; this service never stops its tracks. */
export function createLiveSession({ getListenLang, getTranslateOn, getVolume,
  handlers = {}, localStream, profile, onParticipants = () => {}, backendUrl = BACKEND_URL, getVoiceMode = () => null }) {
  let stopped = false, socket, queue, analyser, source, samples, timer, active;
  let sequence = 0, generation = 0, pendingAudio = null;
  let listenLang = getListenLang(), translateOn = getTranslateOn();
  let audioStream, mimeType, captureEnabled = false;
  const targets = new Map();
  const fallbackTimers = new Map(), fallbackPlayed = new Set(), wavReceived = new Set();
  let volume = getVolume();
  const capture = (value) => { if (!stopped) handlers.onCaptureState?.(value); };
  function cancelFallbacks() { fallbackTimers.forEach(clearTimeout); fallbackTimers.clear(); cancelSpeech(); }
  function remember(set, id) { set.add(id); if (set.size > 100) set.delete(set.values().next().value); }
  const report = (message) => { if (!stopped) handlers.onError?.(message); };
  const status = (value) => { if (!stopped) handlers.onStatus?.(value); };
  const isOpen = () => !stopped && socket?.readyState === 1;
  const send = (value) => {
    if (!isOpen()) return false;
    try { socket.send(JSON.stringify(value)); return true; }
    catch { report('Could not send audio. Leave and rejoin to reconnect.'); return false; }
  };
  async function resumeAudio() {
    if (!queue || stopped) return false;
    try {
      await queue.resume();
      const ready = queue.ctx.state === 'running';
      handlers.onPlaybackBlocked?.(!ready);
      return ready;
    } catch { handlers.onPlaybackBlocked?.(true); return false; }
  }
  // MMS-TTS has no voice for these languages. Wait for the contract's optional
  // WAV marker, then use an available device voice. First playback wins: a late
  // WAV is discarded if browser speech has already begun, avoiding duplicates.
  function scheduleFallback(message) {
    const { id, targetLang } = message;
    const text = typeof message.translated === 'string' ? message.translated : message.original;
    if (!['zh', 'ja', 'it'].includes(targetLang) || !text || !translateOn || targetLang !== listenLang) return;
    if (wavReceived.has(id) || fallbackPlayed.has(id) || fallbackTimers.has(id)) return;
    const expectedGeneration = generation;
    fallbackTimers.set(id, setTimeout(() => {
      fallbackTimers.delete(id);
      if (stopped || !isOpen() || expectedGeneration !== generation || !getTranslateOn() || targetLang !== getListenLang() || wavReceived.has(id)) return;
      const tag = getLanguage(targetLang).tts;
      if (!hasVoice(tag) || getVolume() <= 0) return;
      remember(fallbackPlayed, id);
      void speak(text, tag, getVolume(), {}, () => {
        if (!stopped && expectedGeneration === generation) handlers.onAudioStart?.({ id, browserFallback: true });
      });
    }, 350));
    if (fallbackTimers.size > 100) {
      const first = fallbackTimers.keys().next().value;
      clearTimeout(fallbackTimers.get(first)); fallbackTimers.delete(first);
    }
  }
  function finishUtterance() {
    if (active?.recorder.state === 'recording') active.recorder.stop();
  }
  function startUtterance(now) {
    const id = `${profile.id || 'user'}-${Date.now()}-${++sequence}`;
    let recording;
    try {
      const recorder = new MediaRecorder(audioStream, { mimeType });
      recording = { recorder, id, startedAt: now, lastSpeechAt: now };
      active = recording;
      recorder.ondataavailable = ({ data }) => {
        if (!isOpen() || !data?.size) return;
        // WS accepts Blob directly, preserving order with no async conversion.
        if (socket.bufferedAmount > 4 * 1024 * 1024) {
          report('Connection is too slow to send audio. Leave and rejoin.');
          socket.close(); return;
        }
        try { socket.send(data); }
        catch { report('Could not send audio. Leave and rejoin to reconnect.'); }
      };
      // Final dataavailable precedes stop, so audio_end follows all bytes.
      recorder.onstop = () => {
        if (send({ type: 'audio_end', id })) capture('processing');
        if (active === recording) active = null;
      };
      recorder.onerror = () => {
        report('Microphone recording failed. Leave and rejoin to try again.');
        finishUtterance();
      };
      recorder.start(250);
      if (!send({ type: 'audio_start', id })) finishUtterance();
      else capture('recording');
    } catch {
      if (active === recording) active = null;
      report('This browser could not record WebM/Opus audio. Try Chrome or Edge.');
      captureEnabled = false;
    }
  }
  try {
    queue = new TranslatedAudioQueue();
    queue.setVolume(getVolume());
    window.addEventListener('pointerdown', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    void resumeAudio();
    socket = new WebSocket(backendWsUrl({ ...profile, lang: listenLang }, backendUrl));
    socket.binaryType = 'arraybuffer';
    status('connecting');
  } catch (error) {
    report(error.message || 'Could not connect. Check VITE_BACKEND_URL.');
    status('disconnected');
  }
  const tracks = localStream?.getAudioTracks() ?? [];
  if (queue && tracks.length) {
    mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => globalThis.MediaRecorder?.isTypeSupported?.(type));
    if (!mimeType) report('WebM/Opus recording is unavailable. You can listen; use Chrome or Edge to speak.');
    else try {
      audioStream = new MediaStream(tracks);
      analyser = queue.ctx.createAnalyser();
      analyser.fftSize = 512;
      samples = new Uint8Array(analyser.fftSize);
      source = queue.ctx.createMediaStreamSource(audioStream);
      source.connect(analyser);
      captureEnabled = true;
    } catch { report('Microphone analysis failed. You can still receive translations.'); }
  } else if (!tracks.length) report('No microphone is available. You can still receive translations.');
  function syncSettings() {
    const nextLang = getListenLang(), nextTranslate = getTranslateOn();
    if (nextLang !== listenLang || nextTranslate !== translateOn) {
      generation += 1;
      queue?.flush();
      cancelFallbacks();
      pendingAudio = null;
      if (nextLang !== listenLang) {
        listenLang = nextLang;
        send({ type: 'set_lang', lang: listenLang });
      }
      translateOn = nextTranslate;
    }
    const nextVolume = getVolume();
    if (nextVolume !== volume) { volume = nextVolume; cancelSpeech(); }
    queue?.setVolume(volume);
    queue?.setVoiceEffect(getVoiceMode()?.fx ?? 'none');
  }
  if (socket) {
    socket.onopen = () => {
      if (stopped) return;
      status('connected');
      capture('listening');
      listenLang = getListenLang();
      send({ type: 'set_lang', lang: listenLang });
    };
    socket.onerror = () => report('Backend connection failed. Check the server, then leave and rejoin.');
    socket.onclose = () => {
      finishUtterance(); queue?.flush(); cancelFallbacks(); pendingAudio = null; capture('listening');
      onParticipants([]); status('disconnected');
    };
    socket.onmessage = ({ data }) => {
      if (stopped) return;
      syncSettings();
      if (typeof data !== 'string') {
        const header = pendingAudio;
        pendingAudio = null;
        if (!header || header.generation !== generation || !translateOn || fallbackPlayed.has(header.id)) return;
        if (header.targetLang && header.targetLang !== listenLang) return;
        const bytes = data instanceof ArrayBuffer ? Promise.resolve(data) : data.arrayBuffer();
        void bytes.then((buffer) => {
          if (stopped || header.generation !== generation || !getTranslateOn()) return;
          return queue?.enqueue(buffer, handlers.onAudioStart ? () => {
            if (!stopped && header.generation === generation) handlers.onAudioStart({ id: header.id });
          } : undefined);
        }).catch(() => report('Translated audio could not be played. Captions are still available.'));
        return;
      }
      let message;
      try { message = JSON.parse(data); }
      catch { report('The backend sent an invalid message.'); return; }
      if (!message || typeof message !== 'object') return;
      switch (message.type) {
        case 'participants':
          if (Array.isArray(message.list)) onParticipants(message.list);
          break;
        case 'utterance_start':
          targets.set(message.id, message.targetLang);
          if (targets.size > 100) targets.delete(targets.keys().next().value);
          handlers.onUtteranceStart?.(message);
          break;
        case 'partial': handlers.onPartial?.(message); break;
        case 'utterance_end':
          targets.set(message.id, message.targetLang);
          handlers.onUtteranceEnd?.(message);
          if (targets.size > 100) targets.delete(targets.keys().next().value);
          scheduleFallback(message);
          break;
        case 'audio':
          if (message.format === 'wav') {
            remember(wavReceived, message.id);
            clearTimeout(fallbackTimers.get(message.id)); fallbackTimers.delete(message.id);
          }
          pendingAudio = { id: message.id, generation, targetLang: targets.get(message.id) };
          targets.delete(message.id);
          if (message.format !== 'wav') {
            pendingAudio = null;
            report('The backend sent an unsupported audio format. Expected WAV.');
          }
          break;
        case 'error': report(message.message || 'The backend could not process this utterance.'); break;
        default: break;
      }
    };
    timer = setInterval(() => {
      if (stopped) return;
      syncSettings();
      if (!captureEnabled || !isOpen() || queue.ctx.state !== 'running') return;
      const now = Date.now();
      const micEnabled = tracks.some((track) => track.enabled && track.readyState !== 'ended');
      if (!micEnabled) { finishUtterance(); return; }
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const value of samples) energy += (value - 128) ** 2;
      const speaking = Math.sqrt(energy / samples.length) > 6;
      if (!active && speaking) startUtterance(now);
      if (active?.recorder.state === 'recording') {
        if (speaking) active.lastSpeechAt = now;
        if (now - active.lastSpeechAt >= 720 || now - active.startedAt >= 15000) finishUtterance();
      }
    }, 120);
  }
  return {
    resumeAudio,
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer); cancelFallbacks(); fallbackPlayed.clear(); wavReceived.clear();
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
      // Discard unfinished speech on leave. Server releases it on disconnect.
      if (active) {
        active.recorder.ondataavailable = active.recorder.onstop = active.recorder.onerror = null;
        if (active.recorder.state !== 'inactive') active.recorder.stop();
        active = null;
      }
      source?.disconnect(); analyser?.disconnect(); queue?.close();
      pendingAudio = null; targets.clear();
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        if (socket.readyState < 2) socket.close();
      }
    },
  };
}


