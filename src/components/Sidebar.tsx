'use client'

import { Note, Canvas } from '@/lib/supabase'
import Logo from './Logo'

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

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' })
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
    <aside
      className={`sidebar${sidebarOpen ? ' open' : ''}`}
      style={{
        width: 248, minWidth: 208, height: '100%',
        background: 'rgba(30, 30, 32, 0.72)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '15px 16px 12px', flexShrink: 0 }}>
        <Logo size={25} />
        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--text)', lineHeight: 1 }}>
          pitch<span style={{ color: 'var(--accent-hover)' }}>stone</span>
        </span>
      </div>

      {/* Segmented control */}
      <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: 'rgba(118, 118, 128, 0.18)', borderRadius: 9, padding: 2, gap: 2 }}>
          {(['notes', 'canvases'] as const).map(m => {
            const on = mode === m
            return (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  flex: 1, border: 'none', borderRadius: 7, padding: '5px 0',
                  fontSize: 13, fontWeight: on ? 600 : 400,
                  background: on ? 'var(--surface2)' : 'transparent',
                  color: on ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: on ? '0 1px 3px rgba(0,0,0,0.28)' : 'none',
                  cursor: 'pointer', transition: `all 0.22s ${EASE}`,
                }}
              >{m === 'notes' ? 'Notes' : 'Canvases'}</button>
            )
          })}
        </div>
      </div>

      {/* Search + new */}
      <div style={{ padding: '0 12px 6px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {mode === 'notes' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(118, 118, 128, 0.18)', borderRadius: 9, padding: '6px 9px' }}>
            <SearchIcon />
            <input
              type="text" placeholder="Search" value={search} onChange={e => onSearch(e.target.value)}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
        )}
        {mode === 'canvases' && <span style={{ flex: 1 }} />}
        <button
          onClick={mode === 'notes' ? onCreate : onCreateCanvas}
          title={mode === 'notes' ? 'New note' : 'New canvas'}
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 5px rgba(124, 106, 247, 0.45)', transition: `transform 0.15s ${EASE}`,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        ><PlusIcon /></button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 12px' }}>
        {mode === 'notes' ? (
          filtered.length === 0 ? (
            <Empty text={search ? 'No results' : 'No notes yet'} />
          ) : filtered.map(note => (
            <SidebarItem
              key={note.id}
              label={note.title || 'Untitled'}
              sub={fmtDate(note.updated_at)}
              active={activeId === note.id}
              onSelect={() => onSelect(note.id)}
              onDelete={() => onDelete(note.id)}
            />
          ))
        ) : (
          canvases.length === 0 ? (
            <Empty text="No canvases yet" />
          ) : canvases.map(c => (
            <SidebarItem
              key={c.id}
              label={c.title || 'Untitled Canvas'}
              sub={fmtDate(c.updated_at)}
              active={activeCanvasId === c.id}
              onSelect={() => onSelectCanvas(c.id)}
              onDelete={() => onDeleteCanvas(c.id)}
            />
          ))
        )}
      </div>

      <style>{`.sidebar-item:hover .delete-btn { opacity: 1 !important; }`}</style>
    </aside>
  )
}

function SidebarItem({ label, sub, active, onSelect, onDelete }: {
  label: string; sub: string; active: boolean
  onSelect: () => void; onDelete: () => void
}) {
  return (
    <div
      className="sidebar-item"
      onClick={onSelect}
      style={{
        margin: '1px 8px', padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
        background: active ? 'var(--accent-soft)' : 'transparent',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        transition: 'background 0.13s ease',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete"
        className="delete-btn"
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', borderRadius: 5, display: 'flex', opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }}
      ><TrashIcon /></button>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '24px 18px', color: 'var(--text-muted)', fontSize: 13 }}>{text}</div>
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="var(--text-muted)" strokeWidth="1.6" />
      <line x1="10.6" y1="10.6" x2="14" y2="14" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6h12M8 6V4.5h4V6M6.5 6l.5 9.5h6l.5-9.5M8.5 8.5v5M11.5 8.5v5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
