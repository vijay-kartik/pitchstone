'use client'

import { Note, Canvas } from '@/lib/supabase'

type Props = {
  notes: Note[]
  canvases: Canvas[]
  activeId: string | null
  activeCanvasId: string | null
  mode: 'notes' | 'canvases'
  onModeChange: (m: 'notes' | 'canvases') => void
  onSelect: (id: string) => void
  onSelectCanvas: (id: string) => void
  onCreate: () => void
  onCreateCanvas: () => void
  onDelete: (id: string) => void
  onDeleteCanvas: (id: string) => void
  search: string
  onSearch: (q: string) => void
  sidebarOpen: boolean
}

export default function Sidebar({
  notes, canvases, activeId, activeCanvasId, mode, onModeChange,
  onSelect, onSelectCanvas, onCreate, onCreateCanvas,
  onDelete, onDeleteCanvas, search, onSearch, sidebarOpen,
}: Props) {
  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 240, minWidth: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 12px', flexShrink: 0 }}>
        <svg width="16" height="22" viewBox="0 0 48 66" aria-hidden="true" style={{ flexShrink: 0 }}>
          <polygon points="24,2 6,22 9,52 24,64" fill="#3A3550" />
          <polygon points="24,2 42,22 39,52 24,64" fill="#24212E" />
          <line x1="13" y1="48" x2="34" y2="14" stroke="#9585FF" strokeWidth="3" strokeLinecap="round" />
          <circle cx="34" cy="14" r="4" fill="#C9BFFF" />
        </svg>
        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1 }}>
          pitch<span style={{ color: 'var(--accent-hover)' }}>stone</span>
        </span>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['notes', 'canvases'] as const).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            flex: 1, background: 'none', border: 'none',
            borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
            color: mode === m ? 'var(--accent)' : 'var(--text-muted)',
            padding: '9px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            textTransform: 'capitalize', letterSpacing: '0.04em',
          }}>{m === 'notes' ? '📝 Notes' : '◻ Canvases'}</button>
        ))}
      </div>

      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: mode === 'notes' ? 8 : 0 }}>
          <button
            onClick={mode === 'notes' ? onCreate : onCreateCanvas}
            title={mode === 'notes' ? 'New note' : 'New canvas'}
            style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >+</button>
        </div>
        {mode === 'notes' && (
          <input
            type="text" placeholder="Search…" value={search} onChange={e => onSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
          />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {mode === 'notes' ? (
          <>
            {filtered.length === 0 && (
              <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                {search ? 'No results' : 'No notes yet'}
              </div>
            )}
            {filtered.map(note => (
              <SidebarItem
                key={note.id}
                label={note.title || 'Untitled'}
                sub={new Date(note.updated_at).toLocaleDateString()}
                active={activeId === note.id}
                onSelect={() => onSelect(note.id)}
                onDelete={() => onDelete(note.id)}
              />
            ))}
          </>
        ) : (
          <>
            {canvases.length === 0 && (
              <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No canvases yet</div>
            )}
            {canvases.map(c => (
              <SidebarItem
                key={c.id}
                label={c.title || 'Untitled Canvas'}
                sub={new Date(c.updated_at).toLocaleDateString()}
                active={activeCanvasId === c.id}
                onSelect={() => onSelectCanvas(c.id)}
                onDelete={() => onDeleteCanvas(c.id)}
              />
            ))}
          </>
        )}
      </div>

      <style>{`div:hover .delete-btn { opacity: 1 !important; }`}</style>
    </aside>
  )
}

function SidebarItem({ label, sub, active, onSelect, onDelete }: {
  label: string; sub: string; active: boolean
  onSelect: () => void; onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{ padding: '8px 12px', cursor: 'pointer', background: active ? 'var(--surface2)' : 'transparent', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#2a2a2a' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete() }} title="Delete"
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: 14, opacity: 0, transition: 'opacity 0.1s' }}
        className="delete-btn"
      >✕</button>
    </div>
  )
}
