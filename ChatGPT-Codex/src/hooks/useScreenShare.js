import { useCallback, useEffect, useRef, useState } from 'react';

/** Local screen preview only; this stream is never published to other participants. */
export function useScreenShare() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const streamRef = useRef(null);
  const lifeRef = useRef(null);
  const requestRef = useRef(0);
  const detachRef = useRef(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  const release = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    ++requestRef.current; // invalidate a picker that is still open
    release();
    if (lifeRef.current) setStream(null);
  }, [release]);

  const start = useCallback(async () => {
    const life = lifeRef.current;
    if (!life) return false;
    const request = ++requestRef.current;
    const current = () => lifeRef.current === life && requestRef.current === request;
    setError('');
    if (!supported) { setError('This browser does not support screen sharing.'); return false; }
    let fresh;
    try {
      fresh = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!current()) { fresh.getTracks().forEach((track) => track.stop()); return false; }
      const video = fresh.getVideoTracks().find((track) => track.readyState !== 'ended');
      if (!video) throw new Error('No live screen track');
      release();
      streamRef.current = fresh;
      const ended = () => { if (streamRef.current === fresh) stop(); };
      video.addEventListener('ended', ended);
      detachRef.current = () => video.removeEventListener('ended', ended);
      setStream(fresh);
      return true;
    } catch (err) {
      fresh?.getTracks().forEach((track) => track.stop());
      if (current()) setError(err?.name === 'NotAllowedError'
        ? 'Screen preview was cancelled or blocked.'
        : 'Screen preview could not start on this device.');
      return false;
    }
  }, [supported, release, stop]);

  useEffect(() => {
    const life = Symbol('screen preview');
    lifeRef.current = life;
    return () => {
      if (lifeRef.current === life) lifeRef.current = null;
      ++requestRef.current;
      release();
    };
  }, [release]);

  return { stream, sharing: !!stream, supported, error, start, stop };
}