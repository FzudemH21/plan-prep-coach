/**
 * useVoiceRecorder — records audio in the browser (desktop, iPad, phone) with MediaRecorder.
 *
 * Compressed speech-quality audio (WebM/Opus in Chrome/Edge/Firefox, MP4/AAC in Safari), stops by
 * itself after `maxSeconds`. stop() resolves with the recording; cancel() throws it away. The
 * microphone is released as soon as the recording ends.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t));
}

export function useVoiceRecorder(maxSeconds = 30 * 60) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const cancelledRef = useRef(false);

  const release = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setState('idle');
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise(resolve => {
      resolveRef.current = resolve;
      rec.stop();
    });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = cancelledRef.current
          ? null
          : new Blob(chunksRef.current, { type: rec.mimeType || mimeType || 'audio/webm' });
        chunksRef.current = [];
        release();
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };
      recorderRef.current = rec;
      rec.start(1000);
      setSeconds(0);
      setState('recording');
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) void stop();
      }, 500);
    } catch (err) {
      release();
      const name = err instanceof DOMException ? err.name : '';
      setError(name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in the browser settings and try again.'
        : 'The microphone could not be started.');
    }
  }, [maxSeconds, release, stop]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else release();
  }, [release]);

  // Never leave the microphone on when the component goes away
  useEffect(() => () => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { state, seconds, error, start, stop, cancel };
}
