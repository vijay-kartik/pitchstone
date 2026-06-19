import { createClient } from '@supabase/supabase-js'

export type Note = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export type Recording = {
  id: string
  note_id: string
  storage_path: string
  duration_seconds: number | null
  created_at: string
}

export type CanvasNode = {
  id: string
  type: 'text' | 'note'
  x: number
  y: number
  width: number
  height: number
  content?: string
  noteId?: string
  noteTitle?: string
  color?: string
}

export type CanvasEdge = {
  id: string
  fromId: string
  toId: string
}

export type CanvasData = {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export type Canvas = {
  id: string
  title: string
  data: CanvasData
  created_at: string
  updated_at: string
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
