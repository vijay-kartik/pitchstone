'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, Note, Canvas } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Editor from '@/components/Editor'
import CanvasEditor from '@/components/CanvasEditor'

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([])
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null)
  const [mode, setMode] = useState<'notes' | 'canvases'>('notes')
  const [search, setSearch] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    supabase.from('notes').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      if (data) { setNotes(data); if (data.length > 0) setActiveId(data[0].id) }
    })
  }, [])

  useEffect(() => {
    supabase.from('canvases').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      if (data) setCanvases(data as Canvas[])
    })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('notes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, payload => {
        if (payload.eventType === 'INSERT') {
          const n = payload.new as Note
          setNotes(prev => [n, ...prev.filter(x => x.id !== n.id)])
        } else if (payload.eventType === 'UPDATE') {
          const n = payload.new as Note
          setNotes(prev => prev.map(x => x.id === n.id ? n : x)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
        } else if (payload.eventType === 'DELETE') {
          setNotes(prev => prev.filter(x => x.id !== (payload.old as Note).id))
        }
      })
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'))
    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [])

  const closeSidebar = () => setSidebarOpen(false)

  const createNote = async () => {
    const { data } = await supabase.from('notes').insert({ title: 'Untitled', content: '' }).select().single()
    if (data) { setNotes(prev => [data, ...prev]); setActiveId(data.id); setMode('notes'); closeSidebar() }
  }

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  const updateNote = useCallback(async (id: string, title: string, content: string) => {
    await supabase.from('notes').update({ title, content }).eq('id', id)
    setNotes(prev => prev
      .map(n => n.id === id ? { ...n, title, content, updated_at: new Date().toISOString() } : n)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
  }, [])

  const navigateToTitle = (title: string) => {
    const found = notes.find(n => n.title === title)
    if (found) { setActiveId(found.id); setMode('notes') }
    else {
      supabase.from('notes').insert({ title, content: '' }).select().single().then(({ data }) => {
        if (data) { setNotes(prev => [data, ...prev]); setActiveId(data.id); setMode('notes') }
      })
    }
  }

  const navigateToNote = (noteId: string) => { setActiveId(noteId); setMode('notes') }

  const createCanvas = async () => {
    const { data } = await supabase.from('canvases').insert({ title: 'Untitled Canvas', data: { nodes: [], edges: [] } }).select().single()
    if (data) { setCanvases(prev => [data as Canvas, ...prev]); setActiveCanvasId(data.id); setMode('canvases'); closeSidebar() }
  }

  const deleteCanvas = async (id: string) => {
    if (!confirm('Delete this canvas?')) return
    await supabase.from('canvases').delete().eq('id', id)
    setCanvases(prev => {
      const next = prev.filter(c => c.id !== id)
      if (activeCanvasId === id) setActiveCanvasId(next[0]?.id ?? null)
      return next
    })
  }

  const updateCanvas = useCallback(async (id: string, title: string, data: Canvas['data']) => {
    await supabase.from('canvases').update({ title, data }).eq('id', id)
    setCanvases(prev => prev
      .map(c => c.id === id ? { ...c, title, data, updated_at: new Date().toISOString() } : c)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
  }, [])

  const activeNote = notes.find(n => n.id === activeId)
  const activeCanvas = canvases.find(c => c.id === activeCanvasId)
  const allTitles = notes.map(n => n.title)

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      {/* Mobile sidebar overlay */}
      <div className="sidebar-overlay" onClick={closeSidebar} />

      <Sidebar
        notes={notes}
        canvases={canvases}
        activeId={activeId}
        activeCanvasId={activeCanvasId}
        mode={mode}
        onModeChange={m => setMode(m)}
        onSelect={id => { setActiveId(id); setMode('notes'); closeSidebar() }}
        onSelectCanvas={id => { setActiveCanvasId(id); setMode('canvases'); closeSidebar() }}
        onCreate={createNote}
        onCreateCanvas={createCanvas}
        onDelete={deleteNote}
        onDeleteCanvas={deleteCanvas}
        search={search}
        onSearch={setSearch}
        sidebarOpen={sidebarOpen}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Mobile header bar */}
        <div className="mobile-header">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 20, padding: '2px 4px', lineHeight: 1 }}
          >☰</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mode === 'notes' ? (activeNote?.title || 'Notes') : (activeCanvas?.title || 'Canvases')}
          </span>
        </div>

        {mode === 'notes' ? (
          activeNote ? (
            <Editor
              key={activeNote.id}
              note={activeNote}
              allTitles={allTitles}
              onUpdate={updateNote}
              onNavigate={navigateToTitle}
              isLive={isLive}
            />
          ) : (
            <EmptyState label="No notes yet" actionLabel="Create your first note" onCreate={createNote} />
          )
        ) : (
          <>
            {/* Canvas disabled on mobile */}
            <div className="canvas-mobile-block" style={{ display: 'none', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>◻</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Canvas not available on mobile</div>
              <div style={{ fontSize: 13 }}>Open on a desktop or tablet for the full canvas experience.</div>
              <button onClick={() => setMode('notes')} style={{ marginTop: 8, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Go to Notes</button>
            </div>
            <div className="canvas-desktop-block" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {activeCanvas ? (
                <CanvasEditor
                  key={activeCanvas.id}
                  canvas={activeCanvas}
                  notes={notes}
                  onUpdate={updateCanvas}
                  onNavigateToNote={navigateToNote}
                />
              ) : (
                <EmptyState label="No canvases yet" actionLabel="Create your first canvas" onCreate={createCanvas} />
              )}
            </div>
          </>
        )}
      </main>

      <style>{`
        @media (max-width: 640px) {
          .canvas-mobile-block { display: flex !important; }
          .canvas-desktop-block { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function EmptyState({ label, actionLabel, onCreate }: { label: string; actionLabel: string; onCreate: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 16 }}>
      <div style={{ fontSize: 48 }}>📝</div>
      <div style={{ fontSize: 16, fontWeight: 500 }}>{label}</div>
      <button onClick={onCreate} style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
        {actionLabel}
      </button>
    </div>
  )
}
