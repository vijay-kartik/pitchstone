'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, Canvas, CanvasNode, CanvasEdge, Note } from '@/lib/supabase'

type Props = {
  canvas: Canvas
  notes: Note[]
  onUpdate: (id: string, title: string, data: Canvas['data']) => void
  onNavigateToNote: (noteId: string) => void
}

type DragState = { nodeId: string; startMouseX: number; startMouseY: number; nodeX: number; nodeY: number }
type ResizeState = { nodeId: string; startMouseX: number; startMouseY: number; startW: number; startH: number }

function uid() { return Math.random().toString(36).slice(2) }

function getEdgePath(from: CanvasNode, to: CanvasNode): string {
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height / 2
  const x2 = to.x + to.width / 2
  const y2 = to.y + to.height / 2
  const dx = Math.abs(x2 - x1) * 0.5
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

const COLORS = ['#2d2d2d', '#1a2d1a', '#1a1a2d', '#2d1a1a', '#2d2a1a', '#1a2d2d']

export default function CanvasEditor({ canvas, notes, onUpdate, onNavigateToNote }: Props) {
  const [title, setTitle] = useState(canvas.title)
  const [nodes, setNodes] = useState<CanvasNode[]>(canvas.data.nodes)
  const [edges, setEdges] = useState<CanvasEdge[]>(canvas.data.edges)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [mouseCvs, setMouseCvs] = useState({ x: 0, y: 0 })
  const [showNoteSearch, setShowNoteSearch] = useState(false)
  const [noteQuery, setNoteQuery] = useState('')
  const [addNotePos, setAddNotePos] = useState({ x: 0, y: 0 })
  const [editingTitle, setEditingTitle] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const panningRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const titleRef = useRef(title)

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  useEffect(() => {
    setTitle(canvas.title)
    setNodes(canvas.data.nodes)
    setEdges(canvas.data.edges)
  }, [canvas.id])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onUpdate(canvas.id, titleRef.current, { nodes: nodesRef.current, edges: edgesRef.current })
    }, 600)
  }, [canvas.id, onUpdate])

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: (sx - rect.left - panRef.current.x) / scaleRef.current,
      y: (sy - rect.top - panRef.current.y) / scaleRef.current,
    }
  }, [])

  // ── Mouse handlers ──────────────────────────────────────────
  const onContainerMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    if (e.button !== 0) return
    setSelectedId(null)
    setEditingId(null)
    setConnectingFrom(null)
    panningRef.current = { sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y }
    e.preventDefault()
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const cvs = screenToCanvas(e.clientX, e.clientY)
    setMouseCvs(cvs)

    if (panningRef.current) {
      const dx = e.clientX - panningRef.current.sx
      const dy = e.clientY - panningRef.current.sy
      const nx = panningRef.current.px + dx
      const ny = panningRef.current.py + dy
      panRef.current = { x: nx, y: ny }
      setPan({ x: nx, y: ny })
    }

    if (dragRef.current) {
      const { nodeId, startMouseX, startMouseY, nodeX, nodeY } = dragRef.current
      const dx = (e.clientX - startMouseX) / scaleRef.current
      const dy = (e.clientY - startMouseY) / scaleRef.current
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: nodeX + dx, y: nodeY + dy } : n))
    }

    if (resizeRef.current) {
      const { nodeId, startMouseX, startMouseY, startW, startH } = resizeRef.current
      const dx = (e.clientX - startMouseX) / scaleRef.current
      const dy = (e.clientY - startMouseY) / scaleRef.current
      setNodes(prev => prev.map(n => n.id === nodeId
        ? { ...n, width: Math.max(160, startW + dx), height: Math.max(80, startH + dy) }
        : n))
    }
  }

  const onMouseUp = () => {
    if (dragRef.current || resizeRef.current) scheduleSave()
    panningRef.current = null
    dragRef.current = null
    resizeRef.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(3, Math.max(0.2, scaleRef.current * delta))
    const newPanX = mouseX - (mouseX - panRef.current.x) * (newScale / scaleRef.current)
    const newPanY = mouseY - (mouseY - panRef.current.y) * (newScale / scaleRef.current)
    scaleRef.current = newScale
    panRef.current = { x: newPanX, y: newPanY }
    setScale(newScale)
    setPan({ x: newPanX, y: newPanY })
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    const pos = screenToCanvas(e.clientX, e.clientY)
    const node: CanvasNode = { id: uid(), type: 'text', x: pos.x - 120, y: pos.y - 50, width: 240, height: 100, content: '' }
    setNodes(prev => { const next = [...prev, node]; nodesRef.current = next; return next })
    setEditingId(node.id)
    setSelectedId(node.id)
    scheduleSave()
  }

  // ── Node actions ────────────────────────────────────────────
  const startDrag = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation()
    dragRef.current = { nodeId: node.id, startMouseX: e.clientX, startMouseY: e.clientY, nodeX: node.x, nodeY: node.y }
    setSelectedId(node.id)
    setEditingId(null)
  }

  const startResize = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { nodeId: node.id, startMouseX: e.clientX, startMouseY: e.clientY, startW: node.width, startH: node.height }
  }

  const deleteNode = (id: string) => {
    setNodes(prev => { const next = prev.filter(n => n.id !== id); nodesRef.current = next; return next })
    setEdges(prev => { const next = prev.filter(e => e.fromId !== id && e.toId !== id); edgesRef.current = next; return next })
    setSelectedId(null)
    scheduleSave()
  }

  const deleteEdge = (id: string) => {
    setEdges(prev => { const next = prev.filter(e => e.id !== id); edgesRef.current = next; return next })
    scheduleSave()
  }

  const updateNodeContent = (id: string, content: string) => {
    setNodes(prev => { const next = prev.map(n => n.id === id ? { ...n, content } : n); nodesRef.current = next; return next })
    scheduleSave()
  }

  const cycleColor = (id: string) => {
    setNodes(prev => {
      const next = prev.map(n => {
        if (n.id !== id) return n
        const idx = COLORS.indexOf(n.color ?? COLORS[0])
        return { ...n, color: COLORS[(idx + 1) % COLORS.length] }
      })
      nodesRef.current = next
      return next
    })
    scheduleSave()
  }

  const startConnect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (connectingFrom === null) {
      setConnectingFrom(id)
    } else if (connectingFrom !== id) {
      const edge: CanvasEdge = { id: uid(), fromId: connectingFrom, toId: id }
      setEdges(prev => { const next = [...prev, edge]; edgesRef.current = next; return next })
      setConnectingFrom(null)
      scheduleSave()
    } else {
      setConnectingFrom(null)
    }
  }

  const addNoteCard = (note: Note) => {
    const node: CanvasNode = {
      id: uid(), type: 'note',
      x: addNotePos.x, y: addNotePos.y,
      width: 240, height: 120,
      noteId: note.id, noteTitle: note.title,
      content: note.content.slice(0, 120),
    }
    setNodes(prev => { const next = [...prev, node]; nodesRef.current = next; return next })
    setShowNoteSearch(false)
    setNoteQuery('')
    scheduleSave()
  }

  const openNoteSearch = () => {
    setAddNotePos({ x: (-pan.x / scale) + 100, y: (-pan.y / scale) + 100 })
    setShowNoteSearch(true)
    setNoteQuery('')
  }

  const handleTitleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingTitle(false)
      onUpdate(canvas.id, titleRef.current, { nodes: nodesRef.current, edges: edgesRef.current })
    }
  }

  const fromNode = connectingFrom ? nodes.find(n => n.id === connectingFrom) : null

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(noteQuery.toLowerCase())
  ).slice(0, 8)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={e => { setTitle(e.target.value); titleRef.current = e.target.value }}
            onBlur={() => { setEditingTitle(false); onUpdate(canvas.id, titleRef.current, { nodes: nodesRef.current, edges: edgesRef.current }) }}
            onKeyDown={handleTitleKey}
            style={{ background: 'transparent', border: 'none', outline: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)', fontSize: 15, fontWeight: 600, padding: '2px 6px' }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingTitle(true)}
            style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', cursor: 'text', padding: '2px 6px' }}
            title="Double-click to rename"
          >{title}</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(scale * 100)}%</span>
        <Btn onClick={() => { scaleRef.current = 1; panRef.current = { x: 0, y: 0 }; setScale(1); setPan({ x: 0, y: 0 }) }}>Reset view</Btn>
        <Btn onClick={openNoteSearch}>+ Note card</Btn>
        <Btn onClick={() => {
          const pos = { x: (-pan.x / scale) + 100, y: (-pan.y / scale) + 100 }
          const node: CanvasNode = { id: uid(), type: 'text', x: pos.x, y: pos.y, width: 240, height: 100, content: '' }
          setNodes(prev => { const next = [...prev, node]; nodesRef.current = next; return next })
          setEditingId(node.id)
          setSelectedId(node.id)
          scheduleSave()
        }}>+ Text card</Btn>
        {connectingFrom && (
          <span style={{ fontSize: 12, color: 'var(--accent)', background: '#2a2060', padding: '3px 10px', borderRadius: 6 }}>
            Click another card to connect · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setConnectingFrom(null)}>cancel</span>
          </span>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        onMouseDown={onContainerMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: panningRef.current ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab',
          background: 'var(--bg)',
          backgroundImage: `radial-gradient(circle, #333 1px, transparent 1px)`,
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
          {/* SVG edge layer */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}
            width={0} height={0}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--accent)" />
              </marker>
            </defs>
            {edges.map(edge => {
              const from = nodes.find(n => n.id === edge.fromId)
              const to = nodes.find(n => n.id === edge.toId)
              if (!from || !to) return null
              return (
                <g key={edge.id} style={{ pointerEvents: 'stroke' }}>
                  <path
                    d={getEdgePath(from, to)}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onClick={() => deleteEdge(edge.id)}
                  />
                  <path
                    d={getEdgePath(from, to)}
                    stroke="var(--accent)"
                    strokeWidth={1.5}
                    fill="none"
                    opacity={0.7}
                    markerEnd="url(#arrow)"
                  />
                </g>
              )
            })}
            {/* Connection preview */}
            {fromNode && (
              <line
                x1={fromNode.x + fromNode.width / 2}
                y1={fromNode.y + fromNode.height / 2}
                x2={mouseCvs.x}
                y2={mouseCvs.y}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                opacity={0.8}
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map(node => (
            <NodeCard
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              editing={editingId === node.id}
              connecting={connectingFrom !== null}
              connectingFrom={connectingFrom === node.id}
              onMouseDown={startDrag}
              onResize={startResize}
              onSelect={() => { setSelectedId(node.id); setEditingId(null) }}
              onEdit={() => { setEditingId(node.id); setSelectedId(node.id) }}
              onDelete={() => deleteNode(node.id)}
              onConnect={(e) => startConnect(e, node.id)}
              onContentChange={(v) => updateNodeContent(node.id, v)}
              onCycleColor={() => cycleColor(node.id)}
              onNavigate={() => node.noteId && onNavigateToNote(node.noteId)}
            />
          ))}
        </div>

        {/* Hint */}
        {nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 13, flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>◻</div>
            <div style={{ opacity: 0.5 }}>Double-click to add a card · Scroll to zoom · Drag to pan</div>
          </div>
        )}
      </div>

      {/* Note search modal */}
      {showNoteSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowNoteSearch(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, width: 320, boxShadow: '0 8px 32px #0008' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14, color: 'var(--text)' }}>Add note card</div>
            <input
              autoFocus
              placeholder="Search notes…"
              value={noteQuery}
              onChange={e => setNoteQuery(e.target.value)}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredNotes.map(n => (
                <div key={n.id} onClick={() => addNoteCard(n)} style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >{n.title || 'Untitled'}</div>
              ))}
              {filteredNotes.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '6px 10px' }}>No notes found</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── NodeCard ────────────────────────────────────────────────────
type CardProps = {
  node: CanvasNode
  selected: boolean
  editing: boolean
  connecting: boolean
  connectingFrom: boolean
  onMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
  onResize: (e: React.MouseEvent, node: CanvasNode) => void
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onConnect: (e: React.MouseEvent) => void
  onContentChange: (v: string) => void
  onCycleColor: () => void
  onNavigate: () => void
}

function NodeCard({ node, selected, editing, connecting, connectingFrom, onMouseDown, onResize, onSelect, onEdit, onDelete, onConnect, onContentChange, onCycleColor, onNavigate }: CardProps) {
  const bg = node.color ?? '#2d2d2d'

  return (
    <div
      data-node
      onClick={connecting ? (e) => onConnect(e) : onSelect}
      onDoubleClick={node.type === 'text' ? onEdit : undefined}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        background: bg,
        border: `1.5px solid ${connectingFrom ? 'var(--accent)' : selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        boxShadow: selected ? '0 0 0 2px var(--accent)44' : '0 2px 8px #0004',
        display: 'flex',
        flexDirection: 'column',
        userSelect: editing ? 'text' : 'none',
        zIndex: selected ? 10 : 1,
        transition: 'border-color 0.1s',
      }}
    >
      {/* Drag handle / header */}
      <div
        onMouseDown={e => { onMouseDown(e, node); e.stopPropagation() }}
        style={{ padding: '5px 8px 3px', cursor: 'move', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.type === 'note' ? `📄 ${node.noteTitle ?? 'Note'}` : '✏️ Text'}
        </span>
        {selected && (
          <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
            <IconBtn title="Change color" onClick={onCycleColor}>🎨</IconBtn>
            <IconBtn title={connectingFrom ? 'Cancel connect' : 'Connect to…'} onClick={onConnect} style={{ color: connectingFrom ? 'var(--accent)' : undefined }}>⟶</IconBtn>
            <IconBtn title="Delete" onClick={onDelete}>✕</IconBtn>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 8px 6px' }}>
        {node.type === 'text' ? (
          editing ? (
            <textarea
              autoFocus
              value={node.content ?? ''}
              onChange={e => onContentChange(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden', height: '100%', opacity: node.content ? 1 : 0.3 }}>
              {node.content || 'Double-click to edit…'}
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4 }}>
            <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.noteTitle}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, overflow: 'hidden', flex: 1 }}>{node.content}</div>
            <button
              onClick={e => { e.stopPropagation(); onNavigate() }}
              style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', alignSelf: 'flex-start', flexShrink: 0 }}
            >Open note →</button>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={e => { onResize(e, node); e.stopPropagation() }}
        style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, cursor: 'nwse-resize', opacity: selected ? 0.6 : 0 }}
        data-node
      >
        <svg width={14} height={14} viewBox="0 0 14 14">
          <path d="M14,14 L14,8 L8,14 Z" fill="var(--text-muted)" />
        </svg>
      </div>
    </div>
  )
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
      {children}
    </button>
  )
}

function IconBtn({ onClick, title, children, style: s }: { onClick: (e: React.MouseEvent) => void; title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '1px 3px', borderRadius: 3, ...s }}
    >{children}</button>
  )
}
