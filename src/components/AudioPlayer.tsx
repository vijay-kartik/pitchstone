'use client'

import { useEffect, useRef, useState } from 'react'

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Deterministic pseudo-waveform derived from a seed, so each clip has a
// stable, distinct shape without decoding the audio.
function waveform(seed: string, bars: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const out: number[] = []
  for (let i = 0; i < bars; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0
    out.push(0.22 + (h % 1000) / 1000 * 0.78)
  }
  return out
}

type Props = { src: string; durationHint?: number | null; seed: string }

export default function AudioPlayer({ src, durationHint, seed }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(durationHint ?? 0)
  const [bars] = useState(() => waveform(seed, 56))

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCurrent(a.currentTime)
    const onMeta = () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration) }
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('durationchange', onMeta)
    a.addEventListener('ended', onEnd)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('durationchange', onMeta)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
    }
  }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    a.currentTime = pct * duration
    setCurrent(pct * duration)
  }

  const progress = duration > 0 ? current / duration : 0
  const shownTime = playing || current > 0 ? current : duration

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 auto', minWidth: 0, maxWidth: 440,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 999, padding: '5px 12px 5px 5px',
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', background: 'linear-gradient(135deg, var(--accent), #5b4de0)',
          boxShadow: '0 2px 8px rgba(124,106,247,0.4)',
        }}
      >
        {playing ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1.2" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
      </button>

      <div
        onClick={seek}
        style={{ flex: 1, minWidth: 0, height: 30, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
      >
        {bars.map((b, i) => {
          const filled = i / bars.length <= progress
          return (
            <span key={i} style={{
              flex: 1, height: `${Math.round(b * 100)}%`, minHeight: 3, borderRadius: 2,
              background: filled ? 'var(--accent)' : 'rgba(255,255,255,0.16)',
              transition: 'background 0.12s linear',
            }} />
          )
        })}
      </div>

      <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right' }}>
        {fmt(shownTime)}
      </span>
    </div>
  )
}
