import type { Provider, StreamArgs, EmitFn } from './types'
import { deltaAdapter } from './types'
import { readSSE } from './sse'

export const anthropicProvider: Provider = {
  id: 'anthropic',
  async stream(args: StreamArgs, emit: EmitFn) {
    const onDelta = deltaAdapter(emit)
    const body = {
      model: args.model,
      max_tokens: args.maxTokens ?? 4096,
      temperature: args.temperature ?? 1,
      system: args.systemPrompt,
      stream: true,
      messages: args.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: args.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new Error(`Anthropic ${res.status}: ${text || res.statusText}`)
    }
    for await (const ev of readSSE(res.body, args.signal)) {
      if (ev.event === 'content_block_delta') {
        try {
          const json = JSON.parse(ev.data)
          const text = json?.delta?.text
          if (typeof text === 'string') onDelta(text)
        } catch {
          /* ignore */
        }
      } else if (ev.event === 'message_stop') {
        break
      } else if (ev.event === 'error') {
        try {
          const json = JSON.parse(ev.data)
          throw new Error(json?.error?.message ?? 'Anthropic stream error')
        } catch (e) {
          throw e instanceof Error ? e : new Error('Anthropic stream error')
        }
      }
    }
  }
}
