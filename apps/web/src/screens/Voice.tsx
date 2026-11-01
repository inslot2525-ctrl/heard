// Voice notes: record in the browser (MediaRecorder, Opus), send through Nexconn as an HD voice
// message, and show a transcript + translation (Gemini via our API) under the audio player.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';

export const VOICE_MAX_SECONDS = 60; // Nexconn's limit for HD voice messages

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

/** Tap to record, tap again to send. Stops by itself at 60 s. */
export function VoiceButton({ onRecorded, disabled }: { onRecorded: (file: File, seconds: number) => void; disabled?: boolean }) {
  const t = useT();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => stop(true), []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if ((r as unknown as { cancelled?: boolean }).cancelled) return;
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        const type = r.mimeType || 'audio/webm';
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        onRecorded(new File(chunks, `voice-${Date.now()}.${ext}`, { type }), Math.min(secs, VOICE_MAX_SECONDS));
      };
      rec.current = r;
      started.current = Date.now();
      r.start();
      setRecording(true);
      setSeconds(0);
      timer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= VOICE_MAX_SECONDS) stop(false);
      }, 250);
    } catch {
      setError(t.micDenied);
    }
  }

  function stop(cancel: boolean) {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    if (r && r.state !== 'inactive') {
      (r as unknown as { cancelled?: boolean }).cancelled = cancel;
      r.stop();
    }
  }

  return (
    <>
      {recording ? (
        <>
          <button type="button" className="btn ghost" aria-label={t.cancel} onClick={() => stop(true)}>✕</button>
          <button type="button" className="btn primary rec" onClick={() => stop(false)}>
            ● {seconds}s · {t.sendVoice}
          </button>
        </>
      ) : (
        <button type="button" className="btn" aria-label={t.recordVoice} title={t.recordVoice} disabled={disabled} onClick={() => void start()}>
          🎙️
        </button>
      )}
      {error && <span className="small error">{error}</span>}
    </>
  );
}

interface Transcript {
  transcript: string;
  language: string;
  translation: string;
}

/** Audio player + transcript. The original words are always shown; the translation only if different. */
export function VoiceBubble({ url, duration, myLang }: { url?: string; duration?: number; myLang: string }) {
  const t = useT();
  const [tr, setTr] = useState<Transcript | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

  useEffect(() => {
    if (!url) return;
    const key = `heard.voice.${myLang}.${url}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setTr(JSON.parse(cached) as Transcript);
      return;
    }
    setState('busy');
    api<Transcript>('/voice/transcribe', { body: { url, to: myLang } })
      .then((r) => {
        setTr(r);
        setState('idle');
        localStorage.setItem(key, JSON.stringify({ transcript: r.transcript, language: r.language, translation: r.translation }));
      })
      .catch(() => setState('failed'));
  }, [url, myLang]);

  if (!url) return <div className="bubble muted">[voice]</div>;
  const showTranslation = tr && tr.translation && tr.translation.trim() !== tr.transcript.trim();
  return (
    <div className="bubble voice">
      <audio controls preload="none" src={url} />
      {duration ? <span className="small muted"> {duration}s</span> : null}
      {state === 'busy' && <div className="small muted">{t.transcribing}</div>}
      {state === 'failed' && <div className="small muted">{t.transcriptUnavailable}</div>}
      {tr?.transcript && <div className="transcript">“{tr.transcript}”</div>}
      {showTranslation && (
        <div className="translation">
          <div className="label">{t.translatedFrom}</div>
          {tr!.translation}
        </div>
      )}
    </div>
  );
}
