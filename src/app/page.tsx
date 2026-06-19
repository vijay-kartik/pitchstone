'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, Note } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Editor from '@/components/Editor'

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isLive, setIsLive] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Load notes on mount
  useEffect(() => {
    supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setNotes(data)
          if (data.length > 0) setActiveId(data[0].id)
        }
      })
  }, [])

  // Real-time sync
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

  const createNote = async () => {
    const { data } = await supabase
      .from('notes')
      .insert({ title: 'Untitled', content: '' })
      .select()
      .single()
    if (data) {
      setNotes(prev => [data, ...prev])
      setActiveId(data.id)
    }
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
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    )
  }, [])

  const navigateToTitle = (title: string) => {
    const found = notes.find(n => n.title === title)
    if (found) {
      setActiveId(found.id)
    } else {
      // Create new note with that title
      supabase
        .from('notes')
        .insert({ title, content: '' })
        .select()
        .single()
        .then(({ data }) => {
          if (data) {
            setNotes(prev => [data, ...prev])
            setActiveId(data.id)
          }
        })
    }
  }

  const activeNote = notes.find(n => n.id === activeId)
  const allTitles = notes.map(n => n.title)

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <Sidebar
        notes={notes}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={createNote}
        onDelete={deleteNote}
        search={search}
        onSearch={setSearch}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeNote ? (
          <Editor
            key={activeNote.id}
            note={activeNote}
            allTitles={allTitles}
            onUpdate={updateNote}
            onNavigate={navigateToTitle}
            isLive={isLive}
          />
        ) : (
          <EmptyState onCreate={createNote} />
        )}
      </main>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>📝</div>
      <div style={{ fontSize: 16, fontWeight: 500 }}>No notes yet</div>
      <button
        onClick={onCreate}
        style={{
          background: 'var(--accent)',
          border: 'none',
          color: '#fff',
          borderRadius: 8,
          padding: '8px 20px',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Create your first note
      </button>
    </div>
  )
}
