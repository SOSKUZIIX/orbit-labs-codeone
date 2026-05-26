import type { Provider, StreamArgs, EmitFn } from './types'
import { deltaAdapter } from './types'
import { readSSE } from './sse'

export const googleProvider: Provider = {
  id: 'google',
  async stream(args: StreamArgs, emit: EmitFn) {
    const onDelta = deltaAdapter(emit)
    const contents = args.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: args.temperature ?? 1,
        ...(args.maxTokens ? { maxOutputTokens: args.maxTokens } : {})
      }
    }
    if (args.systemPrompt) {
      body.systemInstruction = { parts: [{ text: args.systemPrompt }] }
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        args.model
      )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(args.apiKey)}`

    const res = await fetch(url, {
      method: 'POST',
      signal: args.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new Error(`Google ${res.status}: ${text || res.statusText}`)
    }
    for await (const ev of readSSE(res.body, args.signal)) {
      try {
        const json = JSON.parse(ev.data)
        const parts = json?.candidates?.[0]?.content?.parts
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (typeof p?.text === 'string' && p.text.length) onDelta(p.text)
          }
        }
      } catch {
        /* ignore parse errors */
      }
    }
  }
}
