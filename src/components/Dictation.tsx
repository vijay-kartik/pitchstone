'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  onText: (text: string) => void
  onError: (msg: string | null) => void
}

// Deepgram language codes. 'multi' enables Hindi+English code-switching.
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'multi', label: 'Auto' },
]

type Phase = 'idle' | 'recording' | 'transcribing'

// Records speech in the browser and transcribes it server-side via Deepgram.
// Browser-independent (only needs MediaRecorder) and reliably multilingual.
export default function Dictation({ onText, onError }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [lang, setLang] = useState('en')

  const phaseRef = useRef<Phase>('idle')
  const langRef = useRef('en')
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)
  useEffect(() => { onTextRef.current = onText }, [onText])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => {
    const saved = localStorage.getItem('dictation-lang')
    if (saved && LANGS.some(l => l.code === saved)) { setLang(saved); langRef.current = saved }
  }, [])

  const transcribe = useCallback(async (blob: Blob) => {
    setPhase('transcribing')
    try {
      const res = await fetch(`/api/transcribe?language=${encodeURIComponent(langRef.current)}`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onErrorRef.current(data.error || 'Transcription failed.')
      } else if (data.text && data.text.trim()) {
        onTextRef.current(data.text.trim())
      }
    } catch {
      onErrorRef.current('Transcription failed. Check your connection.')
    } finally {
      setPhase('idle')
    }
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { onErrorRef.current('Audio recording not supported in this browser.'); return }
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream }
    catch { onErrorRef.current('Microphone access denied. Allow it in browser settings.'); return }

    chunksRef.current = []
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      if (blob.size > 0) transcribe(blob)
      else setPhase('idle')
    }
    mr.start()
    mrRef.current = mr
    onErrorRef.current(null)
    setPhase('recording')
  }, [transcribe])

  const stopRecording = useCallback(() => {
    if (mrRef.current && mrRef.current.state !== 'inactive') mrRef.current.stop()
    mrRef.current = null
    // onstop transitions to 'transcribing'
  }, [])

  const toggle = () => {
    if (phaseRef.current === 'recording') { stopRecording(); return }
    if (phaseRef.current === 'transcribing') return
    start()
  }

  const changeLang = (code: string) => {
    setLang(code)
    langRef.current = code
    try { localStorage.setItem('dictation-lang', code) } catch {}
  }

  useEffect(() => () => {
    try { mrRef.current?.stop() } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const recording = phase === 'recording'
  const transcribing = phase === 'transcribing'

  return (
    <>
      <style>{`
        @keyframes dict-pulse { 0% { transform: scale(1); opacity: .5 } 100% { transform: scale(2.3); opacity: 0 } }
        @keyframes dict-spin { to { transform: rotate(360deg) } }
      `}</style>

      {recording && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--danger)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
          Listening…
        </span>
      )}
      {transcribing && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          Transcribing…
        </span>
      )}

      <select
        value={lang}
        onChange={e => changeLang(e.target.value)}
        disabled={recording || transcribing}
        title="Dictation language"
        aria-label="Dictation language"
        style={{
          height: 34, borderRadius: 9, border: '1px solid var(--border)',
          background: 'var(--surface2)', color: 'var(--text)',
          fontSize: 12.5, fontFamily: 'inherit', padding: '0 6px',
          cursor: recording || transcribing ? 'not-allowed' : 'pointer', outline: 'none', flexShrink: 0,
          opacity: recording || transcribing ? 0.5 : 1,
        }}
      >
        {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>

      <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
        {recording && (
          <span style={{ position: 'absolute', inset: 0, borderRadius: 9, background: 'var(--danger)', animation: 'dict-pulse 1.3s ease-out infinite', pointerEvents: 'none' }} />
        )}
        <button
          onClick={toggle}
          disabled={transcribing}
          title={recording ? 'Stop & transcribe' : 'Dictate to text'}
          aria-label={recording ? 'Stop dictation' : 'Dictate to text'}
          style={{
            position: 'absolute', inset: 0,
            background: recording ? 'var(--danger)' : 'var(--surface2)',
            border: recording ? 'none' : '1px solid var(--border)',
            color: recording ? '#fff' : 'var(--text)',
            borderRadius: 9, cursor: transcribing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: transcribing ? 0.6 : 1, zIndex: 1, transition: 'background 0.2s',
          }}
        >
          {transcribing ? <SpinnerIcon /> : <MicIcon />}
        </button>
      </div>
    </>
  )
}

function MicIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 2a10 10 0 0 1 10 10" style={{ transformOrigin: 'center', animation: 'dict-spin 0.8s linear infinite' }} />
    </svg>
  )
}
