import { createClient } from '@supabase/supabase-js'

export type Note = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
