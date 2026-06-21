import { NextRequest, NextResponse } from 'next/server'

// Server-side transcription via Deepgram Nova-3. The audio is recorded in the
// browser (MediaRecorder) and posted here; the API key never leaves the server.
export async function POST(req: NextRequest) {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Transcription is not configured (missing DEEPGRAM_API_KEY).' }, { status: 500 })
  }

  const requested = req.nextUrl.searchParams.get('language') || 'en'
  const language = ['en', 'hi', 'multi'].includes(requested) ? requested : 'en'
  const contentType = req.headers.get('content-type') || 'audio/webm'

  const audio = await req.arrayBuffer()
  if (!audio || audio.byteLength === 0) {
    return NextResponse.json({ text: '' })
  }

  const params = new URLSearchParams({
    model: 'nova-3',
    language,
    smart_format: 'true',
    punctuate: 'true',
  })

  try {
    const dg = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': contentType },
      body: Buffer.from(audio),
    })

    if (!dg.ok) {
      const detail = await dg.text()
      console.error('Deepgram error', dg.status, detail)
      return NextResponse.json({ error: `Transcription failed (${dg.status}).` }, { status: 502 })
    }

    const data = await dg.json()
    const text: string = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
    return NextResponse.json({ text })
  } catch (e) {
    console.error('Transcription request failed', e)
    return NextResponse.json({ error: 'Transcription request failed.' }, { status: 502 })
  }
}
