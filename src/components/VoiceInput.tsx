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

type Phase = 'idle' | 'recording' | 'locked'

type Props = {
  uploading: boolean
  onTranscript: (text: string) => void
  onRecordingComplete: (blob: Blob, duration: number) => void
  onError: (msg: string | null) => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function VoiceInput({ uploading, onTranscript, onRecordingComplete, onError }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [cancelling, setCancelling] = useState(false)
  const [locking, setLocking] = useState(false)
  const [isTouch, setIsTouch] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const startPosRef = useRef({ x: 0, y: 0 })
  const cancelledRef = useRef(false)
  const listeningRef = useRef(false)
  const recognitionRef = useRef<SR | null>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase }, [phase])

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const createRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'
    rec.onresult = (e) => {
      const finals = Array.from(e.results)
        .filter((r: SpeechRecognitionResult) => r.isFinal)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(' ')
      if (finals) onTranscript(finals.trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onError('Microphone access denied.')
        finishRecording(true)
      }
    }
    rec.onend = () => { if (listeningRef.current) createRecognition() }
    recognitionRef.current = rec
    rec.start()
  }, [onTranscript, onError])

  const finishRecording = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel
    listeningRef.current = false
    stopTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      mrRef.current.stop()
    }
    mrRef.current = null
    phaseRef.current = 'idle'
    setPhase('idle')
    setDrag({ x: 0, y: 0 })
    setCancelling(false)
    setLocking(false)
    setElapsed(0)
  }, [])

  const startRecording = useCallback(async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { onError('Speech recognition not supported — use Safari or Chrome.'); return false }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch {
      onError('Microphone access denied. Allow it in browser settings.')
      return false
    }

    chunksRef.current = []
    startTimeRef.current = Date.now()
    cancelledRef.current = false

    const mr = new MediaRecorder(stream)
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      if (!cancelledRef.current && chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType })
        const duration = (Date.now() - startTimeRef.current) / 1000
        onRecordingComplete(blob, duration)
      }
    }
    mr.start(1000)
    mrRef.current = mr

    listeningRef.current = true
    createRecognition()

    setElapsed(0)
    stopTimer()
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    return true
  }, [createRecognition, onError, onRecordingComplete])

  // ── Pointer events ───────────────────────────────────────────
  // Touch (mobile): hold to record, slide to cancel/lock
  // Mouse (desktop): click to toggle on/off
  const isTouchRef = useRef(false)

  const onPointerDown = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (uploading) return

    // Desktop click-to-toggle: stop if already recording
    if (e.pointerType === 'mouse' && phaseRef.current !== 'idle') {
      finishRecording(false)
      return
    }
    if (phaseRef.current !== 'idle') return

    isTouchRef.current = e.pointerType === 'touch'
    setIsTouch(e.pointerType === 'touch')

    if (isTouchRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId)
      startPosRef.current = { x: e.clientX, y: e.clientY }
      setDrag({ x: 0, y: 0 })
    }

    const ok = await startRecording()
    if (ok) {
      phaseRef.current = 'recording'
      setPhase('recording')
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isTouchRef.current || phaseRef.current !== 'recording') return
    const dx = e.clientX - startPosRef.current.x
    const dy = e.clientY - startPosRef.current.y
    setDrag({ x: dx, y: dy })
    setCancelling(dx < -60)
    setLocking(dy < -60 && dx > -40)
    if (dy < -100 && dx > -40) {
      phaseRef.current = 'locked'
      setPhase('locked')
      setDrag({ x: 0, y: 0 })
      setCancelling(false)
      setLocking(false)
    }
    if (dx < -140) finishRecording(true)
  }

  const onPointerUp = () => {
    // Only auto-stop on touch release; mouse uses click-to-toggle
    if (isTouchRef.current && phaseRef.current === 'recording') finishRecording(false)
  }

  const stopLocked = () => finishRecording(false)
  const cancelLocked = () => finishRecording(true)

  const btnX = phase === 'recording' ? Math.min(0, Math.max(-140, drag.x)) : 0
  const btnY = phase === 'recording' ? Math.min(0, drag.y) : 0

  return (
    <>
      <style>{`
        @keyframes va-pulse {
          0%   { transform: scale(1);   opacity: .6; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes va-bar {
          0%, 100% { transform: scaleY(.25); }
          50%       { transform: scaleY(1); }
        }
        @keyframes va-arrow {
          0%, 100% { transform: translateX(0); opacity: .9; }
          50%       { transform: translateX(-6px); opacity: .4; }
        }
        @keyframes va-lock-pop {
          0%   { transform: translateY(8px) scale(.8); opacity: 0; }
          100% { transform: translateY(0)  scale(1);   opacity: 1; }
        }
        @keyframes va-shake {
          0%,100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }
      `}</style>

      {/* Recording overlay — replaces toolbar controls while active */}
      {phase !== 'idle' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: cancelling ? '#1a0a0a' : 'var(--surface)',
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 10,
          transition: 'background 0.15s',
          borderBottom: '1px solid var(--border)',
        }}>
          {phase === 'locked' || !isTouch ? (
            /* ── Locked / Desktop UI — explicit stop button ── */
            <>
              <button onClick={cancelLocked} style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>Cancel</button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Bars />
                <span style={{ color: '#f55', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(elapsed)}</span>
                {phase === 'locked' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔒 Locked</span>}
              </div>
              <button onClick={stopLocked} style={{ background: 'var(--danger)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>■</button>
            </>
          ) : (
            /* ── Touch hold UI — slide to cancel/lock ── */
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', opacity: cancelling ? 0.3 : 1, transition: 'opacity 0.1s' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', animation: 'va-arrow 1s ease-in-out infinite', display: 'inline-block', flexShrink: 0 }}>◀</span>
                <span style={{ fontSize: 12, color: cancelling ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
                  {cancelling ? 'Release to cancel' : 'Slide to cancel'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Bars />
                <span style={{ color: '#f55', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(elapsed)}</span>
              </div>
              {locking && (
                <div style={{ position: 'absolute', bottom: '100%', right: 14, marginBottom: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 10px', fontSize: 18, animation: 'va-lock-pop .15s ease' }}>
                  🔒
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* The mic button itself */}
      <div style={{ position: 'relative', flexShrink: 0, width: 36, height: 36 }}>
        {/* Pulse rings — only when recording/locked */}
        {phase !== 'idle' && !cancelling && (
          <>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--danger)', animation: 'va-pulse 1.2s ease-out infinite', pointerEvents: 'none' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--danger)', animation: 'va-pulse 1.2s ease-out .4s infinite', pointerEvents: 'none' }} />
          </>
        )}

        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          disabled={uploading && phase === 'idle'}
          style={{
            position: 'absolute', inset: 0,
            background: phase !== 'idle' ? 'var(--danger)' : uploading ? 'var(--surface2)' : 'var(--surface2)',
            border: phase !== 'idle' ? 'none' : '1px solid var(--border)',
            color: phase !== 'idle' ? '#fff' : 'var(--text)',
            borderRadius: '50%',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `translate(${btnX}px, ${btnY}px) scale(${phase === 'recording' && !cancelling ? 1.2 : 1})`,
            transition: phase === 'idle' ? 'transform 0.15s, background 0.15s' : 'background 0.15s',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            animation: cancelling ? 'va-shake .3s ease' : 'none',
            opacity: uploading && phase === 'idle' ? 0.5 : 1,
            zIndex: 1,
          }}
        >
          {uploading && phase === 'idle' ? '⏳' : '🎙'}
        </button>
      </div>
    </>
  )
}

function Bars() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
      {[0, 0.1, 0.2, 0.15, 0.05].map((delay, i) => (
        <span key={i} style={{
          display: 'block', width: 3, height: 20, borderRadius: 2,
          background: 'var(--danger)',
          transformOrigin: 'center',
          animation: `va-bar .7s ease-in-out ${delay}s infinite`,
        }} />
      ))}
    </div>
  )
}
