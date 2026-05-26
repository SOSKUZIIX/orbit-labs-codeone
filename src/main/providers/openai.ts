import type { Provider, StreamArgs, EmitFn } from './types'
import { readSSE } from './sse'
import {
  OPENAI_TOOLS,
  TOOL_USE_PROMPT,
  executeTool,
  type ToolEdit
} from '../agent-tools'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MAX_ITERATIONS = 8

/**
 * Reasoning / next-gen models reject `max_tokens`, `temperature` overrides,
 * and `parallel_tool_calls`. They use `max_completion_tokens` instead and
 * always run at default temperature.
 */
function isReasoningModel(model: string): boolean {
  return /^(o1|o3|o4|gpt-5)/i.test(model)
}

function maxReasoningEffort(model: string): 'high' | 'xhigh' {
  return /^gpt-5\.(4|5)(?:-|$)/i.test(model) ? 'xhigh' : 'high'
}

interface ChatMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

interface ToolCallAccum {
  id: string
  name: string
  arguments: string
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const openaiProvider: Provider = {
  id: 'openai',
  async stream(args: StreamArgs, emit: EmitFn) {
    const hasWorkspace = !!args.workspaceRoot
    const editsAccumulator: ToolEdit[] = []

    // Build initial conversation
    const messages: ChatMsg[] = []
    const sys = args.systemPrompt ?? ''
    const finalSys = hasWorkspace ? sys + TOOL_USE_PROMPT : sys
    if (finalSys) messages.push({ role: 'system', content: finalSys })
    for (const m of args.messages) {
      if (m.role === 'system') continue
      messages.push({ role: m.role, content: m.content })
    }

    const reasoning = isReasoningModel(args.model)

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (args.signal.aborted) return

      const body: Record<string, unknown> = {
        model: args.model,
        messages,
        stream: true
      }
      // Reasoning models (gpt-5*, o1*, o3*, o4*) reject custom temperature
      // and `max_tokens` — they use `max_completion_tokens` instead and run
      // at default temperature.
      if (!reasoning) {
        body.temperature = args.temperature ?? 1
        if (args.maxTokens) body.max_tokens = args.maxTokens
      } else if (args.maxTokens) {
        body.max_completion_tokens = args.maxTokens
      }
      if (reasoning && !hasWorkspace) {
        body.reasoning_effort = maxReasoningEffort(args.model)
      }
      if (hasWorkspace) {
        body.tools = OPENAI_TOOLS
        body.tool_choice = 'auto'
        // parallel_tool_calls is unsupported on some reasoning models —
        // omit it there and let the API default apply.
        if (!reasoning) body.parallel_tool_calls = true
      }

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: args.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${args.apiKey}`
        },
        body: JSON.stringify(body)
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`openai ${res.status}: ${text || res.statusText}`)
      }

      let assistantContent = ''
      const toolCalls = new Map<number, ToolCallAccum>()
      let finishReason: string | null = null

      for await (const ev of readSSE(res.body, args.signal)) {
        if (ev.data === '[DONE]') break
        let json: {
          choices?: Array<{
            delta?: {
              content?: string
              tool_calls?: Array<{
                index?: number
                id?: string
                function?: { name?: string; arguments?: string }
              }>
            }
            finish_reason?: string | null
          }>
        }
        try {
          json = JSON.parse(ev.data)
        } catch {
          continue
        }
        const choice = json.choices?.[0]
        if (!choice) continue
        const delta = choice.delta ?? {}
        if (typeof delta.content === 'string' && delta.content.length) {
          emit({ type: 'content', text: delta.content })
          assistantContent += delta.content
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            const existing = toolCalls.get(idx) ?? {
              id: '',
              name: '',
              arguments: ''
            }
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            if (typeof tc.function?.arguments === 'string') {
              existing.arguments += tc.function.arguments
            }
            toolCalls.set(idx, existing)
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason
      }

      if (finishReason === 'tool_calls' && toolCalls.size > 0) {
        // Append the assistant's tool-call turn
        const calls = [...toolCalls.values()]
        messages.push({
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: calls.map((c) => ({
            id: c.id || uid(),
            type: 'function' as const,
            function: { name: c.name, arguments: c.arguments || '{}' }
          }))
        })

        // Execute each tool call, append the tool result turn
        let stopAfterCards = false
        for (const call of calls) {
          if (args.signal.aborted) return
          let parsed: Record<string, unknown> = {}
          try {
            parsed = JSON.parse(call.arguments || '{}')
          } catch {
            /* invalid args */
          }

          let resultText = ''

          // UI-emitting tools — special-cased: emit a card, return ack.
          // After these we STOP the loop so 'busy' clears immediately and
          // the user's click on the card isn't dropped by the busy guard.
          if (call.name === 'ask_questions' || call.name === 'propose_plan') {
            stopAfterCards = true
          }
          if (call.name === 'ask_questions') {
            const rawQs = (parsed.questions as unknown[]) ?? []
            const questions = rawQs
              .filter(
                (q): q is { id: string; text: string; options: string[] } => {
                  return (
                    !!q &&
                    typeof q === 'object' &&
                    typeof (q as { id?: unknown }).id === 'string' &&
                    typeof (q as { text?: unknown }).text === 'string' &&
                    Array.isArray((q as { options?: unknown }).options)
                  )
                }
              )
              .map((q) => ({
                id: q.id,
                text: q.text,
                options: (q.options as unknown[])
                  .map((o) => String(o))
                  .filter(Boolean)
              }))
            emit({
              type: 'card',
              card: {
                type: 'question',
                cardId: uid(),
                intro: '',
                questions,
                status: 'pending'
              }
            })
            resultText = JSON.stringify({
              ok: true,
              displayed: true,
              note: 'Questions are now shown to the user as an interactive form. End your turn — the user\'s answers will arrive as the next user message.'
            })
          } else if (call.name === 'propose_plan') {
            emit({
              type: 'card',
              card: {
                type: 'plan',
                cardId: uid(),
                title: String(parsed.title ?? 'Plan'),
                summary: String(parsed.summary ?? ''),
                status: 'pending'
              }
            })
            resultText = JSON.stringify({
              ok: true,
              displayed: true,
              note: 'The plan card with Cancel and Proceed buttons is now shown. End your turn — the user\'s decision will arrive as the next user message ("Proceed" or "Cancel").'
            })
          } else {
            // Stream a small status line for fs tools so the user sees what's happening
            emit({
              type: 'content',
              text: `\n\n→ \`${call.name}\` ${oneLineArgs(call.name, parsed)}\n`
            })
            try {
              const r = await executeTool(
                args.workspaceRoot ?? null,
                call.name,
                parsed
              )
              if (r.edit) editsAccumulator.push(r.edit)
              resultText = JSON.stringify(r.output)
            } catch (err) {
              resultText = JSON.stringify({
                error: err instanceof Error ? err.message : String(err)
              })
            }
          }

          messages.push({
            role: 'tool',
            tool_call_id: call.id || uid(),
            content: resultText.slice(0, 12000)
          })
        }
        // If we just emitted a UI card (questions / plan), stop the outer
        // loop now. The card itself IS the model's message — making another
        // OpenAI request just to get a brief acknowledgment keeps `busy`
        // true for seconds, during which the user's click on the card would
        // be dropped by the busy guard in useChat.send().
        if (stopAfterCards) break
        // Otherwise continue the loop — let the model react to the tool results
        continue
      }

      // No tool calls → done
      break
    }

    if (editsAccumulator.length > 0) {
      emit({
        type: 'card',
        card: {
          type: 'file-edits',
          cardId: uid(),
          edits: dedupeEdits(editsAccumulator)
        }
      })
    }
  }
}

function dedupeEdits(edits: ToolEdit[]): ToolEdit[] {
  // If the same path is created then modified, collapse to created.
  // If created then deleted, drop both.
  const byPath = new Map<string, ToolEdit['action']>()
  for (const e of edits) {
    const prev = byPath.get(e.path)
    if (!prev) {
      byPath.set(e.path, e.action)
    } else if (prev === 'created' && e.action === 'modified') {
      byPath.set(e.path, 'created')
    } else if (prev === 'created' && e.action === 'deleted') {
      byPath.delete(e.path)
    } else {
      byPath.set(e.path, e.action)
    }
  }
  return [...byPath.entries()].map(([path, action]) => ({ path, action }))
}

function oneLineArgs(
  name: string,
  args: Record<string, unknown>
): string {
  switch (name) {
    case 'read_file':
    case 'list_directory':
    case 'delete_file':
      return String(args.path ?? '')
    case 'write_file': {
      const c = String(args.content ?? '')
      return `${args.path ?? ''} (${Buffer.byteLength(c, 'utf8')} bytes)`
    }
    case 'apply_patch':
      return String(args.path ?? '')
    case 'search_files':
      return `"${String(args.query ?? '')}"`
    default:
      return ''
  }
}
