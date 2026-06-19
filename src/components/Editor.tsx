'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Note } from '@/lib/supabase'

type Props = {
  note: Note
  allTitles: string[]
  onUpdate: (id: string, title: string, content: string) => void
  onNavigate: (title: string) => void
  isLive: boolean
}

type SR = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition: new () => SR
    webkitSpeechRecognition: new () => SR
  }
}

export default function Editor({ note, allTitles, onUpdate, onNavigate, isLive }: Props) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SR | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const titleRef = useRef(title)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    contentRef.current = note.content
    titleRef.current = note.title
  }, [note.id])

  const scheduleSave = useCallback((newTitle: string, newContent: string) => {
    titleRef.current = newTitle
    contentRef.current = newContent
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onUpdate(note.id, titleRef.current, contentRef.current)
    }, 600)
  }, [note.id, onUpdate])

  const handleTitle = (v: string) => {
    setTitle(v)
    scheduleSave(v, contentRef.current)
  }

  const handleContent = (v: string) => {
    setContent(v)
    scheduleSave(titleRef.current, v)
  }

  // Voice input
  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Speech recognition not supported in this browser.')

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'

    rec.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join(' ')
      const next = contentRef.current + (contentRef.current ? ' ' : '') + transcript.trim()
      setContent(next)
      scheduleSave(titleRef.current, next)
    }

    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  // Preview renderer
  const renderPreview = (text: string) => {
    let html = text
      // escape HTML
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // wiki links
      .replace(/\[\[([^\]]+)\]\]/g, (_, t) => {
        const exists = allTitles.includes(t)
        return `<span class="${exists ? 'wiki-link' : 'wiki-link-missing'}" data-title="${t}">[[${t}]]</span>`
      })
      // urls
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      // bold, italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // headings
      .replace(/^### (.+)$/gm, '<h3 style="margin:12px 0 4px;font-size:15px;color:var(--text)">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="margin:14px 0 4px;font-size:17px;color:var(--text)">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="margin:16px 0 6px;font-size:20px;color:var(--text)">$1</h1>')
      // newlines
      .replace(/\n/g, '<br>')

    return html
  }

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.dataset.title) onNavigate(target.dataset.title)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface)',
      }}>
        <input
          value={title}
          onChange={e => handleTitle(e.target.value)}
          placeholder="Untitled"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: 16,
            fontWeight: 600,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isLive && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4caf50', display: 'inline-block' }} />
              Live
            </span>
          )}
          <TabBtn active={mode === 'edit'} onClick={() => setMode('edit')}>Edit</TabBtn>
          <TabBtn active={mode === 'preview'} onClick={() => setMode('preview')}>Preview</TabBtn>
          <button
            onClick={toggleVoice}
            title={listening ? 'Stop recording' : 'Voice input'}
            style={{
              background: listening ? 'var(--danger)' : 'var(--surface2)',
              border: '1px solid var(--border)',
              color: listening ? '#fff' : 'var(--text)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'background 0.15s',
            }}
          >
            {listening ? '⏹ Stop' : '🎙 Voice'}
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'edit' ? (
        <textarea
          value={content}
          onChange={e => handleContent(e.target.value)}
          placeholder={'Start typing…\n\nTips:\n  [[Note title]] — link to another note\n  **bold**, *italic*\n  # Heading\n  https://... — clickable link'}
          style={{
            flex: 1,
            background: 'var(--bg)',
            border: 'none',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.7,
            padding: '20px 28px',
            outline: 'none',
            resize: 'none',
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}
        />
      ) : (
        <div
          onClick={handlePreviewClick}
          dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px 28px',
            fontSize: 14,
            lineHeight: 1.8,
            color: 'var(--text)',
          }}
        />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--surface2)',
        border: '1px solid var(--border)',
        color: active ? '#fff' : 'var(--text-muted)',
        borderRadius: 6,
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
