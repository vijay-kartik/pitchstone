'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, Note, Recording } from '@/lib/supabase'
import VoiceInput from './VoiceInput'

type Props = {
  note: Note
  allTitles: string[]
  onUpdate: (id: string, title: string, content: string) => void
  onNavigate: (title: string) => void
}

export default function Editor({ note, allTitles, onUpdate, onNavigate }: Props) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [uploading, setUploading] = useState(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const titleRef = useRef(title)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    contentRef.current = note.content
    titleRef.current = note.title
  }, [note.id])

  useEffect(() => {
    supabase
      .from('recordings').select('*').eq('note_id', note.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRecordings(data ?? []))
  }, [note.id])

  const scheduleSave = useCallback((newTitle: string, newContent: string) => {
    titleRef.current = newTitle
    contentRef.current = newContent
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      onUpdate(note.id, titleRef.current, contentRef.current)
      if (titleRef.current === 'Untitled' && contentRef.current.trim().length >= 20) {
        try {
          const res = await fetch('/api/title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: contentRef.current }),
          })
          const { title } = await res.json()
          if (title) {
            titleRef.current = title
            setTitle(title)
            onUpdate(note.id, title, contentRef.current)
          }
        } catch {}
      }
    }, 600)
  }, [note.id, onUpdate])

  const handleTitle = (v: string) => { setTitle(v); scheduleSave(v, contentRef.current) }
  const handleContent = (v: string) => { setContent(v); scheduleSave(titleRef.current, v) }

  const handleTranscript = useCallback((text: string) => {
    const next = contentRef.current + (contentRef.current ? ' ' : '') + text
    setContent(next)
    scheduleSave(titleRef.current, next)
  }, [scheduleSave])

  const handleRecordingComplete = useCallback(async (blob: Blob, durationSeconds: number) => {
    setUploading(true)
    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${note.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('recordings').upload(path, blob, { contentType: blob.type })
      if (error) throw error
      const { data } = await supabase
        .from('recordings')
        .insert({ note_id: note.id, storage_path: path, duration_seconds: Math.round(durationSeconds) })
        .select().single()
      if (data) setRecordings(prev => [data, ...prev])
    } catch (e) {
      console.error('Upload failed', e)
      setVoiceError('Failed to save recording.')
    } finally {
      setUploading(false)
    }
  }, [note.id])

  const deleteRecording = async (rec: Recording) => {
    await supabase.storage.from('recordings').remove([rec.storage_path])
    await supabase.from('recordings').delete().eq('id', rec.id)
    setRecordings(prev => prev.filter(r => r.id !== rec.id))
  }

  const getUrl = (path: string) =>
    supabase.storage.from('recordings').getPublicUrl(path).data.publicUrl

  const fmtDuration = (s: number | null) => {
    if (!s) return ''
    const m = Math.floor(s / 60), sec = Math.round(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ position: 'relative', padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', flexWrap: 'wrap', flexShrink: 0 }}>
        <input
          value={title}
          onChange={e => handleTitle(e.target.value)}
          placeholder="Untitled"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 16, fontWeight: 600, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <VoiceInput
            uploading={uploading}
            onTranscript={handleTranscript}
            onRecordingComplete={handleRecordingComplete}
            onError={setVoiceError}
          />
        </div>
      </div>

      {voiceError && (
        <div style={{ background: '#3a1a1a', borderBottom: '1px solid var(--danger)', color: '#f88', fontSize: 12, padding: '6px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          {voiceError}
          <button onClick={() => setVoiceError(null)} style={{ background: 'none', border: 'none', color: '#f88', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Recordings panel */}
      {recordings.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Recordings</div>
          {recordings.map(rec => (
            <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <audio src={getUrl(rec.storage_path)} controls style={{ height: 28, flex: 1, minWidth: 0, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(rec.created_at).toLocaleString()} {rec.duration_seconds ? `· ${fmtDuration(rec.duration_seconds)}` : ''}
              </span>
              <button onClick={() => deleteRecording(rec)} title="Delete recording"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <textarea
        value={content}
        onChange={e => handleContent(e.target.value)}
        placeholder={'Start typing…\n\nTips:\n  [[Note title]] — link to another note\n  **bold**, *italic*\n  # Heading\n  https://... — clickable link'}
        style={{ flex: 1, background: 'var(--bg)', border: 'none', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, padding: 'clamp(12px, 4vw, 28px)', outline: 'none', resize: 'none', fontFamily: "'SF Mono', 'Fira Code', monospace" }}
      />
    </div>
  )
}

