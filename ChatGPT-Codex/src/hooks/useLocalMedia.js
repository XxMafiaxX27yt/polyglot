import { useCallback, useEffect, useRef, useState } from 'react';

const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO = { width: { ideal: 1280 }, height: { ideal: 720 } };
const liveTracks = (stream, kind) => (stream?.getTracks() ?? []).filter((t) => t.readyState !== 'ended' && (!kind || t.kind === kind));
const stopTracks = (stream) => stream?.getTracks().forEach((t) => t.stop());

/** Camera/mic capture. Pending device requests cannot replace newer requests or survive unmount. */
export function useLocalMedia(preferred = {}) {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('pending');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [devices, setDevices] = useState({ mics: [], cams: [] });
  const [selected, setSelected] = useState({ micId: null, camId: null });
  const [deviceError, setDeviceError] = useState('');
  const streamRef = useRef(null);
  const lifeRef = useRef(null);
  const requests = useRef({ mic: 0, cam: 0 });
  const onRef = useRef({ mic: true, cam: true });
  onRef.current = { mic: micOn, cam: camOn };

  const refreshDevices = useCallback(async () => {
    const life = lifeRef.current;
    if (!life) return;
    try {
      const all = await navigator.mediaDevices?.enumerateDevices?.();
      if (life !== lifeRef.current || !all) return;
      const named = (kind) => all.filter((d) => d.kind === kind && d.deviceId && d.label);
      setDevices({ mics: named('audioinput'), cams: named('videoinput') });
    } catch { /* Selectors stay hidden if enumeration is unavailable. */ }
  }, []);

  const adopt = useCallback((next) => {
    streamRef.current = next;
    setStream(next);
    const aud = liveTracks(next, 'audio')[0];
    const vid = liveTracks(next, 'video')[0];
    setSelected({ micId: aud?.getSettings?.().deviceId ?? null, camId: vid?.getSettings?.().deviceId ?? null });
    setMicOn(!!aud?.enabled);
    setCamOn(!!vid?.enabled);
    onRef.current = { mic: !!aud?.enabled, cam: !!vid?.enabled };
    setStatus(aud || vid ? 'ready' : 'blocked');
  }, []);

  useEffect(() => {
    const life = Symbol('capture');
    lifeRef.current = life;
    const current = () => lifeRef.current === life;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setMicOn(false); setCamOn(false); setStatus('blocked'); return; }
      const audio = { ...AUDIO, ...(preferred.micId && { deviceId: { ideal: preferred.micId } }) };
      const video = { ...VIDEO, ...(preferred.camId && { deviceId: { ideal: preferred.camId } }) };
      for (const constraints of [{ video, audio }, { video: false, audio }, { video, audio: false }]) {
        try {
          const fresh = await navigator.mediaDevices.getUserMedia(constraints);
          if (!current()) { stopTracks(fresh); return; }
          if (!liveTracks(fresh).length) { stopTracks(fresh); continue; }
          adopt(fresh);
          refreshDevices();
          return;
        } catch { if (!current()) return; }
      }
      if (current()) { setMicOn(false); setCamOn(false); setStatus('blocked'); }
    }
    start();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      if (current()) lifeRef.current = null;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
    // Preferred devices are read once, when capture starts.
  }, []);

  const toggleMic = useCallback(() => {
    const tracks = liveTracks(streamRef.current, 'audio');
    if (!tracks.length) return;
    const enabled = !onRef.current.mic;
    tracks.forEach((t) => { t.enabled = enabled; });
    onRef.current.mic = enabled;
    setMicOn(enabled);
  }, []);
  const toggleCam = useCallback(() => {
    const tracks = liveTracks(streamRef.current, 'video');
    if (!tracks.length) return;
    const enabled = !onRef.current.cam;
    tracks.forEach((t) => { t.enabled = enabled; });
    onRef.current.cam = enabled;
    setCamOn(enabled);
  }, []);

  const switchDevice = useCallback(async (kind, deviceId) => {
    if (!['mic', 'cam'].includes(kind) || !lifeRef.current) return false;
    const life = lifeRef.current;
    const request = ++requests.current[kind];
    const current = () => lifeRef.current === life && requests.current[kind] === request;
    const isMic = kind === 'mic';
    const trackKind = isMic ? 'audio' : 'video';
    let fresh;
    setDeviceError('');
    try {
      fresh = await navigator.mediaDevices.getUserMedia(isMic
        ? { audio: { ...AUDIO, deviceId: { exact: deviceId } }, video: false }
        : { video: { ...VIDEO, deviceId: { exact: deviceId } }, audio: false });
      if (!current()) { stopTracks(fresh); return false; }
      const track = liveTracks(fresh, trackKind)[0];
      if (!track) throw new Error('Device returned no live track');
      track.enabled = onRef.current[kind];
      const old = liveTracks(streamRef.current);
      const next = new MediaStream([...old.filter((t) => t.kind !== trackKind), track]);
      adopt(next);
      old.filter((t) => t.kind === trackKind).forEach((t) => t.stop());
      fresh.getTracks().filter((t) => t !== track).forEach((t) => t.stop());
      refreshDevices();
      return true;
    } catch {
      stopTracks(fresh);
      if (current()) setDeviceError(`Could not switch to that ${isMic ? 'microphone' : 'camera'}. It may be in use or unplugged.`);
      return false;
    }
  }, [adopt, refreshDevices]);

  return { stream, status, micOn, camOn, hasMic: !!liveTracks(stream, 'audio').length,
    hasCam: !!liveTracks(stream, 'video').length, toggleMic, toggleCam, devices, selected, switchDevice, deviceError };
}
/** RMS meter, also used by the call's speaking indicator. */
function useMicMeter(stream, enabled, map, idle) {
  const [level, setLevel] = useState(idle);
  const mapRef = useRef(map);
  mapRef.current = map;
  useEffect(() => {
    setLevel(idle);
    const tracks = liveTracks(stream, 'audio');
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!enabled || !tracks.length || !Ctx) return;
    let ctx, source, analyser, timer;
    let active = true;
    const resume = () => { if (active && ctx?.state === 'suspended') ctx.resume().catch(() => {}); };
    try {
      ctx = new Ctx();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source = ctx.createMediaStreamSource(new MediaStream(tracks));
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const sample = () => {
        if (!active) return;
        if (!tracks.some((t) => t.enabled && t.readyState !== 'ended') || ctx.state !== 'running') { setLevel(idle); return; }
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        setLevel(mapRef.current(Math.sqrt(sum / data.length)));
      };
      timer = setInterval(sample, 100);
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
      resume();
    } catch { /* Capture still works when the optional input meter is unavailable. */ }
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      source?.disconnect();
      analyser?.disconnect();
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    };
  }, [stream, enabled, idle]);
  return level;
}

/** Live microphone input level in 20 steps from 0 to 1. */
export function useMicLevel(stream, enabled) {
  return useMicMeter(stream, enabled, (rms) => Math.round(Math.min(1, rms / 40) * 20) / 20, 0);
}

export function useMicSpeaking(stream, enabled) {
  return useMicMeter(stream, enabled, (rms) => rms > 6, false);
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}