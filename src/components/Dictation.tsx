'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SR = {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((e: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void; stop: () => void
}
declare global {
  interface Window { SpeechRecognition: new () => SR; webkitSpeechRecognition: new () => SR }
}

type Props = {
  onText: (text: string) => void
  onError: (msg: string | null) => void
}

// Live speech-to-text. Runs SpeechRecognition only (no MediaRecorder), so it
// doesn't contend with the audio recorder for the microphone. Finalized
// phrases are inserted into the note as they're recognized.
export default function Dictation({ onText, onError }: Props) {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(true)
  const activeRef = useRef(false)
  const recRef = useRef<SR | null>(null)

  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)
  useEffect(() => { onTextRef.current = onText }, [onText])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  const stop = useCallback(() => {
    activeRef.current = false
    setActive(false)
    try { recRef.current?.stop() } catch {}
    recRef.current = null
  }, [])

  const create = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Ctor) return
    const rec: SR = new Ctor()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      const finals = Array.from(e.results)
        .filter((r: SpeechRecognitionResult) => r.isFinal)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(' ')
        .trim()
      if (finals) onTextRef.current(finals)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onErrorRef.current('Microphone access denied. Allow it in browser settings.')
        stop()
      }
      // 'no-speech' / 'aborted' are transient — onend restarts while active
    }
    rec.onend = () => { if (activeRef.current) create() }
    recRef.current = rec
    try { rec.start() } catch {}
  }, [stop])

  const toggle = () => {
    if (!supported) { onErrorRef.current('Dictation needs Safari or Chrome.'); return }
    if (activeRef.current) { stop(); return }
    onErrorRef.current(null)
    activeRef.current = true
    setActive(true)
    create()
  }

  useEffect(() => () => { activeRef.current = false; try { recRef.current?.stop() } catch {} }, [])

  return (
    <>
      <style>{`@keyframes dict-pulse { 0% { transform: scale(1); opacity: .5 } 100% { transform: scale(2.3); opacity: 0 } }`}</style>

      {active && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--danger)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
          Listening…
        </span>
      )}

      <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
        {active && (
          <span style={{ position: 'absolute', inset: 0, borderRadius: 9, background: 'var(--danger)', animation: 'dict-pulse 1.3s ease-out infinite', pointerEvents: 'none' }} />
        )}
        <button
          onClick={toggle}
          title={active ? 'Stop dictation' : 'Dictate to text'}
          aria-label={active ? 'Stop dictation' : 'Dictate to text'}
          style={{
            position: 'absolute', inset: 0,
            background: active ? 'var(--danger)' : 'var(--surface2)',
            border: active ? 'none' : '1px solid var(--border)',
            color: active ? '#fff' : 'var(--text)',
            borderRadius: 9, cursor: supported ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: supported ? 1 : 0.5, zIndex: 1,
            transition: 'background 0.2s',
          }}
        >
          <MicIcon />
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
