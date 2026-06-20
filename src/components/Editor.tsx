'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { marked } from 'marked'
import { supabase, Note, Recording } from '@/lib/supabase'
import VoiceInput from './VoiceInput'
import Dictation from './Dictation'
import AudioPlayer from './AudioPlayer'

type Props = {
  note: Note
  allTitles: string[]
  onUpdate: (id: string, title: string, content: string) => void
  onNavigate: (title: string) => void
}

// Detect whether stored content is HTML or legacy markdown
const isHTML = (s: string) => /^\s*</.test(s)

// Parse stored content to HTML for Tiptap
async function toHTML(content: string): Promise<string> {
  if (!content) return ''
  if (isHTML(content)) return content
  // Legacy markdown → HTML
  const html = await marked(content)
  return html as string
}

export default function Editor({ note, allTitles, onUpdate, onNavigate }: Props) {
  const [title, setTitle] = useState(note.title)
  const [uploading, setUploading] = useState(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef(title)
  const contentRef = useRef(note.content)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const scheduleSave = useCallback((newTitle: string, newContent: string) => {
    titleRef.current = newTitle
    contentRef.current = newContent
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      onUpdate(note.id, titleRef.current, contentRef.current)
      if (titleRef.current === 'Untitled' && contentRef.current.replace(/<[^>]+>/g, '').trim().length >= 20) {
        try {
          const res = await fetch('/api/title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: contentRef.current.replace(/<[^>]+>/g, '') }),
          })
          const { title: ai } = await res.json()
          if (ai) {
            titleRef.current = ai
            setTitle(ai)
            onUpdate(note.id, ai, contentRef.current)
          }
        } catch {}
      }
    }, 600)
  }, [note.id, onUpdate])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start typing…\n\nTip: use # for headings, **bold**, *italic*, [[Note title]] for links' }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    editorProps: {
      attributes: {
        // Mobile keyboards (Gboard predictive text / iOS autocorrect) deliver
        // characters via composition events and auto-replace text, which bypasses
        // ProseMirror's markdown input rules. Turning these off lets the rules fire.
        autocapitalize: 'off',
        autocorrect: 'off',
        autocomplete: 'off',
        spellcheck: 'false',
        style: [
          'flex:1',
          'outline:none',
          'min-height:100%',
          'padding:clamp(12px,4vw,28px)',
          'font-size:15px',
          'line-height:1.8',
          'color:var(--text)',
        ].join(';'),
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(titleRef.current, editor.getHTML())
    },
  })

  // Full reset when switching to a different note
  useEffect(() => {
    setTitle(note.title)
    titleRef.current = note.title
    if (!editor) return
    toHTML(note.content).then(html => {
      editor.commands.setContent(html, { emitUpdate: false })
      contentRef.current = editor.getHTML()
    })
  }, [note.id]) // eslint-disable-line

  // Live external updates to the SAME note (e.g. edited on another device).
  // Only applied when the user isn't actively typing here, so the cursor is never clobbered.
  useEffect(() => {
    if (!editor || editor.isFocused) return
    let cancelled = false
    toHTML(note.content).then(html => {
      if (cancelled) return
      if (html !== editor.getHTML()) {
        editor.commands.setContent(html, { emitUpdate: false })
        contentRef.current = editor.getHTML()
      }
    })
    return () => { cancelled = true }
  }, [note.content, editor])

  // External title updates when the title field isn't being edited here
  useEffect(() => {
    if (document.activeElement === titleInputRef.current) return
    setTitle(note.title)
    titleRef.current = note.title
  }, [note.title])

  useEffect(() => {
    supabase
      .from('recordings').select('*').eq('note_id', note.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRecordings(data ?? []))
  }, [note.id])

  // Wiki link click handler
  const handleEditorClick = (e: React.MouseEvent) => {
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) return
    const text = (e.target as HTMLElement).closest('p,li,h1,h2,h3,h4,blockquote')?.textContent ?? ''
    const match = /\[\[([^\]]+)\]\]/.exec(text)
    if (match) onNavigate(match[1])
  }

  const handleTranscript = useCallback((text: string) => {
    if (!editor) return
    // Append at the document end without stealing focus, so dictating on
    // mobile doesn't pop the soft keyboard.
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, (end > 2 ? ' ' : '') + text).run()
    scheduleSave(titleRef.current, editor.getHTML())
  }, [editor, scheduleSave])

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

  const handleTitle = (v: string) => { setTitle(v); scheduleSave(v, contentRef.current) }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ position: 'relative', padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(30, 30, 32, 0.8)', flexWrap: 'wrap', flexShrink: 0 }}>
        <input
          ref={titleInputRef}
          value={title}
          onChange={e => handleTitle(e.target.value)}
          placeholder="Untitled"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 16, fontWeight: 600, outline: 'none' }}
        />
        <Dictation onText={handleTranscript} onError={setVoiceError} />
        <VoiceInput
          uploading={uploading}
          onRecordingComplete={handleRecordingComplete}
          onError={setVoiceError}
        />
      </div>

      {voiceError && (
        <div style={{ background: '#3a1a1a', borderBottom: '1px solid var(--danger)', color: '#f88', fontSize: 12, padding: '6px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          {voiceError}
          <button onClick={() => setVoiceError(null)} style={{ background: 'none', border: 'none', color: '#f88', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Recordings panel */}
      {recordings.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'rgba(30, 30, 32, 0.6)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Recordings</div>
          {recordings.map(rec => (
            <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AudioPlayer src={getUrl(rec.storage_path)} durationHint={rec.duration_seconds} seed={rec.id} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {new Date(rec.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
              <button onClick={() => deleteRecording(rec)} title="Delete recording"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Tiptap editor body */}
      <div
        onClick={handleEditorClick}
        style={{ flex: 1, overflow: 'auto', background: 'transparent', display: 'flex', flexDirection: 'column' }}
      >
        <EditorContent editor={editor} style={{ flex: 1, display: 'flex', flexDirection: 'column' }} />
      </div>

      <style>{`
        .tiptap { flex: 1; }
        .tiptap p { margin: 0 0 0.6em; }
        .tiptap h1 { font-size: 1.8em; font-weight: 700; margin: 0.8em 0 0.4em; color: var(--text); }
        .tiptap h2 { font-size: 1.4em; font-weight: 600; margin: 0.7em 0 0.3em; color: var(--text); }
        .tiptap h3 { font-size: 1.15em; font-weight: 600; margin: 0.6em 0 0.3em; color: var(--text); }
        .tiptap strong { color: var(--text); font-weight: 700; }
        .tiptap em { color: var(--text); font-style: italic; opacity: 0.85; }
        .tiptap a { color: var(--accent); text-decoration: underline; }
        .tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap li { margin: 0.2em 0; }
        .tiptap blockquote { border-left: 3px solid var(--accent); margin: 0.6em 0; padding: 0.3em 0 0.3em 1em; color: var(--text-muted); }
        .tiptap code { background: var(--surface2); border-radius: 4px; padding: 1px 5px; font-family: 'SF Mono','Fira Code',monospace; font-size: 0.88em; }
        .tiptap pre { background: var(--surface2); border-radius: 8px; padding: 12px 16px; overflow-x: auto; margin: 0.6em 0; }
        .tiptap pre code { background: none; padding: 0; }
        .tiptap hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
        .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; float: left; height: 0; white-space: pre-line; }
      `}</style>
    </div>
  )
}
