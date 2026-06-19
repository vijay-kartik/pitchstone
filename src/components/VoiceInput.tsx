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

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export default function VoiceInput({ uploading, onTranscript, onRecordingComplete, onError }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [cancelling, setCancelling] = useState(false)
  const [locking, setLocking] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const cancelledRef = useRef(false)
  const listeningRef = useRef(false)
  const recognitionRef = useRef<SR | null>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const onTranscriptRef = useRef(onTranscript)
  const onRecordingCompleteRef = useRef(onRecordingComplete)
  const onErrorRef = useRef(onError)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onRecordingCompleteRef.current = onRecordingComplete }, [onRecordingComplete])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const createRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'
    rec.onresult = (e) => {
      const finals = Array.from(e.results)
        .filter((r: SpeechRecognitionResult) => r.isFinal)
        .map((r: SpeechRecognitionResult) => r[0].transcript).join(' ')
      if (finals) onTranscriptRef.current(finals.trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onErrorRef.current('Microphone access denied.')
        doFinish(true)
      }
    }
    rec.onend = () => { if (listeningRef.current) createRecognition() }
    recognitionRef.current = rec
    rec.start()
  }, []) // eslint-disable-line

  const doFinish = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel
    listeningRef.current = false
    stopTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mrRef.current && mrRef.current.state !== 'inactive') mrRef.current.stop()
    mrRef.current = null
    phaseRef.current = 'idle'
    setPhase('idle')
    setDrag({ x: 0, y: 0 })
    setCancelling(false)
    setLocking(false)
    setElapsed(0)
    setIsTouch(false)
  }, [])

  const doStart = useCallback(async (): Promise<boolean> => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { onErrorRef.current('Speech recognition not supported — use Safari or Chrome.'); return false }
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream }
    catch { onErrorRef.current('Microphone access denied.'); return false }
    chunksRef.current = []
    startTimeRef.current = Date.now()
    cancelledRef.current = false
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      if (!cancelledRef.current && chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType })
        onRecordingCompleteRef.current(blob, (Date.now() - startTimeRef.current) / 1000)
      }
    }
    mr.start(1000); mrRef.current = mr
    listeningRef.current = true
    createRecognition()
    setElapsed(0); stopTimer()
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return true
  }, [createRecognition])

  // Desktop: click to toggle
  const handleClick = async () => {
    if (uploading || isTouch) return
    if (phaseRef.current !== 'idle') { doFinish(false); return }
    const ok = await doStart()
    if (ok) { phaseRef.current = 'recording'; setPhase('recording') }
  }

  // Mobile: native touch listeners (passive:false required for preventDefault + slide tracking)
  useEffect(() => {
    const btn = btnRef.current
    if (!btn) return
    let startX = 0, startY = 0

    const onTouchStart = async (e: TouchEvent) => {
      if (uploading || phaseRef.current !== 'idle') return
      e.preventDefault()
      setIsTouch(true)
      const t = e.touches[0]; startX = t.clientX; startY = t.clientY
      setDrag({ x: 0, y: 0 })
      const ok = await doStart()
      if (ok) { phaseRef.current = 'recording'; setPhase('recording') }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (phaseRef.current !== 'recording') return
      e.preventDefault()
      const t = e.touches[0]
      const dx = t.clientX - startX, dy = t.clientY - startY
      setDrag({ x: dx, y: dy })
      setCancelling(dx < -60)
      setLocking(dy < -60 && dx > -40)
      if (dy < -100 && dx > -40) {
        phaseRef.current = 'locked'; setPhase('locked')
        setDrag({ x: 0, y: 0 }); setCancelling(false); setLocking(false)
      }
      if (dx < -140) doFinish(true)
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (phaseRef.current === 'recording') doFinish(false)
    }

    btn.addEventListener('touchstart',  onTouchStart, { passive: false })
    btn.addEventListener('touchmove',   onTouchMove,  { passive: false })
    btn.addEventListener('touchend',    onTouchEnd,   { passive: false })
    btn.addEventListener('touchcancel', onTouchEnd,   { passive: false })
    return () => {
      btn.removeEventListener('touchstart',  onTouchStart)
      btn.removeEventListener('touchmove',   onTouchMove)
      btn.removeEventListener('touchend',    onTouchEnd)
      btn.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [doStart, doFinish, uploading])

  const btnX = phase === 'recording' && isTouch ? Math.min(0, Math.max(-140, drag.x)) : 0
  const btnY = phase === 'recording' && isTouch ? Math.min(0, drag.y) : 0
  const active = phase !== 'idle'

  return (
    <>
      <style>{`
        @keyframes va-pulse {
          0%   { transform: scale(1);   opacity: .5; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes va-bar {
          0%, 100% { transform: scaleY(.3); }
          50%       { transform: scaleY(1); }
        }
        @keyframes va-arrow {
          0%, 100% { transform: translateX(0);   opacity: 1; }
          50%       { transform: translateX(-7px); opacity: .3; }
        }
        @keyframes va-lock-pop {
          0%   { transform: scale(.7) translateY(6px); opacity: 0; }
          100% { transform: scale(1)  translateY(0);   opacity: 1; }
        }
        @keyframes va-shake {
          0%,100% { transform: translateX(0); }
          25%      { transform: translateX(-5px); }
          75%      { transform: translateX(5px); }
        }
      `}</style>

      {/* ── Desktop toolbar overlay ─────────────────────────── */}
      {!isMobile && active && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: cancelling ? '#1a0a0a' : 'var(--surface)',
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 10, transition: 'background 0.15s',
          borderBottom: '1px solid var(--border)',
        }}>
          <button onClick={() => doFinish(true)} style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>Cancel</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Bars />
            <span style={{ color: '#f55', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(elapsed)}</span>
            {phase === 'locked' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔒 Locked</span>}
          </div>
          <button onClick={() => doFinish(false)} style={{ background: 'var(--danger)', border: 'none', color: '#fff', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <StopIcon />
          </button>
        </div>
      )}

      {/* ── Mobile: floating status strip above FAB ─────────── */}
      {isMobile && active && (
        <div style={{
          position: 'fixed', bottom: 90, left: 16, right: 16, zIndex: 101,
          background: cancelling ? '#1a0a0a' : 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 24px #0006',
          transition: 'background 0.15s',
        }}>
          {phase === 'locked' || !isTouch ? (
            <>
              <button onClick={() => doFinish(true)} style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>Cancel</button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Bars />
                <span style={{ color: '#f55', fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(elapsed)}</span>
                {phase === 'locked' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔒</span>}
              </div>
              <button onClick={() => doFinish(false)} style={{ background: 'var(--danger)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <StopIcon />
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', animation: 'va-arrow 1s ease-in-out infinite', display: 'inline-block', flexShrink: 0 }}>◀</span>
              <span style={{ flex: 1, fontSize: 13, color: cancelling ? 'var(--danger)' : 'var(--text-muted)', transition: 'color 0.15s' }}>
                {cancelling ? 'Release to cancel' : 'Slide to cancel'}
              </span>
              <Bars />
              <span style={{ color: '#f55', fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>{fmt(elapsed)}</span>
            </>
          )}
        </div>
      )}

      {/* Lock hint (mobile touch, sliding up) */}
      {isMobile && locking && (
        <div style={{ position: 'fixed', bottom: 155, right: 20, zIndex: 102, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, animation: 'va-lock-pop .15s ease', boxShadow: '0 2px 12px #0006' }}>
          🔒
        </div>
      )}

      {/* ── The mic button ─────────────────────────────────── */}
      <div style={isMobile ? {
        position: 'fixed', bottom: 24, right: 20, zIndex: 100,
        width: 60, height: 60,
      } : {
        position: 'relative', flexShrink: 0, width: 36, height: 36,
      }}>
        {/* Pulse rings */}
        {active && !cancelling && (
          <>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--danger)', animation: 'va-pulse 1.4s ease-out infinite', pointerEvents: 'none' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--danger)', animation: 'va-pulse 1.4s ease-out .5s infinite', pointerEvents: 'none' }} />
          </>
        )}

        <button
          ref={btnRef}
          onClick={handleClick}
          disabled={uploading && !active}
          style={{
            position: 'absolute', inset: 0,
            background: active
              ? 'var(--danger)'
              : isMobile
                ? 'linear-gradient(135deg, var(--accent), #5b4de0)'
                : 'var(--surface2)',
            border: 'none',
            color: active ? '#fff' : isMobile ? '#fff' : 'var(--text)',
            borderRadius: '50%',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `translate(${btnX}px, ${btnY}px) scale(${active && isTouch && !cancelling ? 1.12 : 1})`,
            transition: phase === 'idle' ? 'transform 0.15s, background 0.3s' : 'background 0.15s',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            animation: cancelling ? 'va-shake .3s ease' : 'none',
            opacity: uploading && !active ? 0.5 : 1,
            zIndex: 1,
            boxShadow: isMobile && !active ? '0 4px 20px rgba(124,106,247,0.5)' : isMobile && active ? '0 4px 20px rgba(224,92,92,0.5)' : 'none',
          }}
        >
          {uploading && !active ? <SpinnerIcon size={isMobile ? 24 : 18} /> : <MicIcon size={isMobile ? 26 : 17} />}
        </button>
      </div>
    </>
  )
}

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

function SpinnerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}

function Bars() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
      {[0, 0.12, 0.24, 0.18, 0.06].map((delay, i) => (
        <span key={i} style={{ display: 'block', width: 3, height: 20, borderRadius: 2, background: 'var(--danger)', transformOrigin: 'center', animation: `va-bar .7s ease-in-out ${delay}s infinite` }} />
      ))}
    </div>
  )
}
