'use client'

import { Note } from '@/lib/supabase'

type Props = {
  notes: Note[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  search: string
  onSearch: (q: string) => void
}

export default function Sidebar({ notes, activeId, onSelect, onCreate, onDelete, search, onSearch }: Props) {
  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside style={{
      width: 240,
      minWidth: 200,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: 'var(--text)' }}>Notes</span>
          <button
            onClick={onCreate}
            title="New note"
            style={{
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              borderRadius: 6,
              width: 26,
              height: 26,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >+</button>
        </div>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '5px 8px',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
            {search ? 'No results' : 'No notes yet'}
          </div>
        )}
        {filtered.map(note => (
          <div
            key={note.id}
            onClick={() => onSelect(note.id)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              background: activeId === note.id ? 'var(--surface2)' : 'transparent',
              borderLeft: activeId === note.id ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (activeId !== note.id) (e.currentTarget as HTMLElement).style.background = '#2a2a2a'
            }}
            onMouseLeave={e => {
              if (activeId !== note.id) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note.title || 'Untitled'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {new Date(note.updated_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(note.id) }}
              title="Delete"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                fontSize: 14,
                opacity: 0,
                transition: 'opacity 0.1s',
              }}
              className="delete-btn"
            >✕</button>
          </div>
        ))}
      </div>

      <style>{`
        div:hover .delete-btn { opacity: 1 !important; }
      `}</style>
    </aside>
  )
}
