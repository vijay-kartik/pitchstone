import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { content } = await req.json()
  if (!content || content.trim().length < 20) {
    return NextResponse.json({ title: null })
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 60,
    messages: [{
      role: 'user',
      content: `Generate a concise, descriptive title (3-7 words) for this note. Reply with ONLY the title, no quotes, no punctuation at the end:\n\n${content.slice(0, 1000)}`,
    }],
  })

  const title = (message.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json({ title })
}
