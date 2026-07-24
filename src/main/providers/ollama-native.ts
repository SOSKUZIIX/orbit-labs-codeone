import type { StreamArgs, EmitFn } from './types'
import { safeFetch } from '../net-guard'
import { localNativeEndpoint } from './local-runtime'
import {
  OPENAI_TOOLS,
  TOOL_USE_PROMPT,
  executeTool,
  type ToolEdit
} from '../agent-tools'
import { dedupeEdits, oneLineArgs } from './openai-core'

const MAX_ITERATIONS = 8

/**
 * A generous context window for the offline agent. The runtime drops the FRONT
 * of the prompt when the context overflows — i.e. the system prompt and the
 * tool definitions — which is exactly why small models "forget" they have tools
 * and paste code into chat instead. The OpenAI-compat `/v1` shim ignores
 * `num_ctx`; the native `/api/chat` endpoint honours it per request, so we set
 * it here and no longer depend on the user exporting OLLAMA_CONTEXT_LENGTH.
 */
const LOCAL_NUM_CTX = 16384

/** Small local models follow the tool-call format far more reliably at low
 *  temperature; cap it regardless of the user's creative-writing setting. */
const LOCAL_TEMPERATURE_CAP = 0.4

/** Valid tool names — gate text-parsed tool calls so an arbitrary JSON object
 *  the model prints as an example is never mistaken for a real call. */
const TOOL_NAMES = new Set(OPENAI_TOOLS.map((t) => t.function.name))

/**
 * Reinforces the exact tool-call format for models that do not reliably emit
 * structured `tool_calls`. Qwen2.5-Coder is trained on the <tool_call> tag
 * format; stating it explicitly — and short — dramatically improves adherence
 * on the 3B/7B tiers. We parse both this tagged form and bare JSON as a
 * fallback (see {@link extractTextToolCalls}).
 */
const LOCAL_TOOL_FORMAT_PROMPT = `

HOW TO CALL A TOOL — READ CAREFULLY:
To create or change a file you MUST call a tool. NEVER paste file contents or code blocks into the chat for the user to copy — that is a failure. Emit the tool call wrapped in <tool_call></tool_call> tags containing ONLY valid JSON, for example:
<tool_call>{"name": "write_file", "arguments": {"path": "index.html", "content": "<!doctype html>\\n<html>...full file...</html>"}}</tool_call>
Rules:
- The JSON must be strictly valid: every key and every string value in double quotes, newlines inside strings escaped as \\n.
- Put the ENTIRE file contents in "content". Never abbreviate or write "// rest of code here".
- Emit the tool call and then STOP. Do not also paste the code in prose. The result comes back as the next message.
- Tools: write_file(path, content) · apply_patch(path, old_text, new_text) · read_file(path) · list_directory(path) · search_files(query) · delete_file(path).`

/**
 * The shared TOOL_USE_PROMPT hard-gates write tools behind plan approval. That
 * is right for PLAN mode but wrong for AGENT mode, where the user expects the
 * agent to just build. This directive goes LAST in the system prompt so it is
 * the model's most recent, most authoritative instruction.
 */
function modeDirective(mode?: string): string {
  if (mode === 'plan') {
    return `\n\nYOU ARE IN PLAN MODE: do NOT write or edit files yet. If you truly need information, ask via ask_questions; otherwise call propose_plan with your approach, then STOP and wait for approval.`
  }
  return `\n\nYOU ARE IN AGENT MODE — ACT NOW. Do NOT wait for approval and do NOT call propose_plan. Immediately use write_file / apply_patch to create and edit EVERY file needed to fully satisfy the request, reading files first when unsure. Actually creating the files is your job. NEVER paste code or file contents in chat for the user to save — that is a failure. Finish with a one-line summary of what you changed.`
}

interface NativeCall {
  id: string
  name: string
  /** JSON-encoded arguments object. */
  arguments: string
}

interface NativeMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> }
  }>
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ---------- tolerant tool-call extraction from free text ----------

/**
 * Destructive tools are NEVER synthesized from free text — only from a real,
 * structured tool_calls response. This stops an explanatory example in prose
 * ("to delete a file you'd call {\"name\":\"delete_file\",...}") from actually
 * deleting a file. A genuine deletion still works via structured tool calls.
 */
const TEXT_PARSE_DENY = new Set<string>(['delete_file'])

/** Markers that mean the model echoed the FORMAT EXAMPLE, not real content —
 *  never write these to disk. */
const PLACEHOLDER_RE =
  /full file contents here|\.\.\.\s*full file\s*\.\.\.|rest of (?:the )?(?:code|file)|your (?:file )?contents here|<full[^>]*>/i

function isNonEmptyStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}
function looksLikePlaceholder(v: unknown): boolean {
  return typeof v === 'string' && PLACEHOLDER_RE.test(v)
}

/**
 * Repair the malformations small local models actually produce, in order of
 * frequency:
 *  1. an unquoted string value after `"name":`  ({"name": write_file, ...})
 *  2. raw control characters (newlines/tabs) inside a JSON string literal —
 *     the dominant failure for multi-line file content, which otherwise makes
 *     the whole tool call unparseable and leaks to chat.
 */
function repairJson(text: string): string {
  const named = text.replace(
    /("name"\s*:\s*)([A-Za-z_][A-Za-z0-9_]*)/g,
    '$1"$2"'
  )
  let out = ''
  let inStr = false
  let esc = false
  for (let i = 0; i < named.length; i++) {
    const ch = named[i]
    if (inStr) {
      if (esc) {
        out += ch
        esc = false
      } else if (ch === '\\') {
        out += ch
        esc = true
      } else if (ch === '"') {
        out += ch
        inStr = false
      } else {
        const code = ch.charCodeAt(0)
        if (code < 0x20) {
          out +=
            ch === '\n'
              ? '\\n'
              : ch === '\r'
                ? '\\r'
                : ch === '\t'
                  ? '\\t'
                  : '\\u' + code.toString(16).padStart(4, '0')
        } else {
          out += ch
        }
      }
    } else {
      if (ch === '"') inStr = true
      out += ch
    }
  }
  return out
}

/** Best-effort JSON parse: strict first, then repaired. Null if still invalid. */
function tolerantParse(raw: string): unknown {
  const text = raw.trim()
  try {
    return JSON.parse(text)
  } catch {
    /* fall through to repair */
  }
  try {
    return JSON.parse(repairJson(text))
  } catch {
    return null
  }
}

/** Do the parsed arguments structurally satisfy the tool? Gates text-parsed
 *  calls so a name-only match (or a placeholder example) is never executed. */
function argsValid(name: string, a: Record<string, unknown>): boolean {
  switch (name) {
    case 'write_file':
      // content may be a string or an object/array (executeTool coerces object
      // → JSON); reject only if missing or an obvious placeholder example.
      return isNonEmptyStr(a.path) && a.content != null && !looksLikePlaceholder(a.content)
    case 'apply_patch':
      return (
        isNonEmptyStr(a.path) &&
        isNonEmptyStr(a.old_text ?? a.oldText) &&
        !looksLikePlaceholder(a.new_text ?? a.newText)
      )
    case 'read_file':
      return isNonEmptyStr(a.path)
    case 'search_files':
      return isNonEmptyStr(a.query)
    case 'list_directory':
      return true // path optional (defaults to '.')
    case 'ask_questions':
      return Array.isArray(a.questions)
    case 'propose_plan':
      return isNonEmptyStr(a.title) || isNonEmptyStr(a.summary)
    default:
      return true
  }
}

/**
 * Turn a parsed object into a NativeCall if — and only if — it names a real,
 * text-permitted tool AND its arguments are structurally valid. This is the
 * gate that keeps illustrative example JSON from being executed.
 */
function toCall(obj: unknown): NativeCall | null {
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const name = rec.name
  if (typeof name !== 'string' || !TOOL_NAMES.has(name)) return null
  if (TEXT_PARSE_DENY.has(name)) return null
  let args: unknown = rec.arguments ?? rec.parameters ?? {}
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      /* leave as-is */
    }
  }
  if (!args || typeof args !== 'object') args = {}
  if (!argsValid(name, args as Record<string, unknown>)) return null
  return { id: uid(), name, arguments: JSON.stringify(args) }
}

/** Scan for balanced top-level {...} objects that mention "name". */
function balancedJsonObjects(s: string): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue
    let depth = 0
    let inStr = false
    let esc = false
    for (let j = i; j < s.length; j++) {
      const ch = s[j]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
      } else if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          const chunk = s.slice(i, j + 1)
          if (chunk.includes('"name"')) out.push(chunk)
          i = j // skip past this object
          break
        }
      }
    }
  }
  return out
}

/**
 * Extract tool calls a model emitted as TEXT (rather than structured
 * `tool_calls`). Tries, in order: <tool_call> tags, fenced ```json blocks, then
 * — only when the reply IS the JSON object — a bare object.
 *
 * `cleaned` is the content with all tool markup removed, so raw JSON is never
 * shown to the user even when a call fails to parse. `sawMarkup` is true when
 * the model clearly ATTEMPTED a tool call (a tag or a tool-shaped fence was
 * present); the caller uses it to ask the model to re-emit a malformed call
 * rather than silently dropping it.
 */
export function extractTextToolCalls(content: string): {
  calls: NativeCall[]
  cleaned: string
  sawMarkup: boolean
} {
  let cleaned = content
  let sawMarkup = false

  // 1) <tool_call>...</tool_call> — Qwen's native text format. Always strip the
  //    tags (parsed or not) so a malformed blob can't leak into chat.
  const tagRe = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi
  const tagged: string[] = []
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(content))) tagged.push(m[1])
  if (tagged.length) {
    sawMarkup = true
    cleaned = content.replace(tagRe, '').trim()
    const calls = tagged
      .map((t) => toCall(tolerantParse(t)))
      .filter(Boolean) as NativeCall[]
    if (calls.length) return { calls, cleaned, sawMarkup }
  }

  // 2) fenced ```json / ```tool_call blocks that parse to a tool call.
  const fenceRe = /```(?:json|tool_call)?\s*([\s\S]*?)```/gi
  const fenceCalls: NativeCall[] = []
  const fences: string[] = []
  while ((m = fenceRe.exec(content))) {
    const call = toCall(tolerantParse(m[1]))
    if (call) {
      fenceCalls.push(call)
      fences.push(m[0])
    }
  }
  if (fenceCalls.length) {
    for (const f of fences) cleaned = cleaned.replace(f, '')
    return { calls: fenceCalls, cleaned: cleaned.trim(), sawMarkup: true }
  }

  // 3) bare balanced JSON — ONLY when the reply STARTS with the object. This
  //    admits a real untagged call (the whole message is the JSON) while
  //    rejecting an example embedded in prose ("the format is {...}"), which
  //    would otherwise be executed and could overwrite/delete files.
  if (content.trimStart().startsWith('{')) {
    const bareCalls: NativeCall[] = []
    for (const chunk of balancedJsonObjects(content)) {
      const call = toCall(tolerantParse(chunk))
      if (call) {
        bareCalls.push(call)
        cleaned = cleaned.replace(chunk, '')
      }
    }
    if (bareCalls.length) {
      return { calls: bareCalls, cleaned: cleaned.trim(), sawMarkup }
    }
  }

  return { calls: [], cleaned: cleaned.trim(), sawMarkup }
}

// ---------- native /api/chat streaming ----------

/** Stream one native /api/chat completion, buffering content (so tool-call
 *  JSON never leaks to the UI) and capturing any structured tool_calls. */
async function callOllama(
  endpoint: string,
  body: Record<string, unknown>,
  signal: AbortSignal
): Promise<{ content: string; toolCalls: NativeCall[]; done: boolean }> {
  const res = await safeFetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`local ${res.status}: ${text || res.statusText}`)
  }

  let content = ''
  const toolCalls: NativeCall[] = []
  let sawDone = false
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    if (signal.aborted) break
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let j: {
        message?: {
          content?: string
          tool_calls?: Array<{
            function?: { name?: string; arguments?: unknown }
          }>
        }
        done?: boolean
        error?: string
      }
      try {
        j = JSON.parse(line)
      } catch {
        continue
      }
      if (j.error) throw new Error(`local: ${j.error}`)
      const msg = j.message
      if (msg?.content) content += msg.content
      if (Array.isArray(msg?.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const name = tc.function?.name
          if (typeof name !== 'string') continue
          const rawArgs = tc.function?.arguments
          const argsStr =
            typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs ?? {})
          toolCalls.push({ id: uid(), name, arguments: argsStr })
        }
      }
      if (j.done) sawDone = true
    }
  }
  return { content, toolCalls, done: sawDone }
}

/**
 * Drive the offline coding agent through Ollama's NATIVE /api/chat endpoint.
 * Compared with the OpenAI-compat path this adds the two things small local
 * models need to actually edit files instead of narrating: a real `num_ctx`
 * (so the tool schema isn't truncated) and tolerant parsing of tool calls the
 * model emits as text. No API key, loopback only — the air-gap holds.
 */
export async function streamOllamaNative(
  args: StreamArgs,
  emit: EmitFn,
  opts: { modelMap: Record<string, string>; label: string }
): Promise<void> {
  const endpoint = localNativeEndpoint()
  const model = opts.modelMap[args.model] ?? args.model
  const hasWorkspace = !!args.workspaceRoot
  const editsAccumulator: ToolEdit[] = []

  const messages: NativeMsg[] = []
  const sys = args.systemPrompt ?? ''
  const finalSys = hasWorkspace
    ? sys + TOOL_USE_PROMPT + LOCAL_TOOL_FORMAT_PROMPT + modeDirective(args.mode)
    : sys
  if (finalSys) messages.push({ role: 'system', content: finalSys })
  for (const msg of args.messages) {
    if (msg.role === 'system') continue
    messages.push({ role: msg.role, content: msg.content })
  }

  const temperature = Math.min(args.temperature ?? 0.3, LOCAL_TEMPERATURE_CAP)

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (args.signal.aborted) return

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      keep_alive: '10m',
      options: { num_ctx: LOCAL_NUM_CTX, temperature }
    }
    if (hasWorkspace) body.tools = OPENAI_TOOLS

    const { content, toolCalls: structured } = await callOllama(
      endpoint,
      body,
      args.signal
    )
    if (args.signal.aborted) return

    // Prefer structured tool_calls; fall back to parsing them out of the text
    // (what the 3B/7B tiers actually do). Only text-parse when a workspace is
    // open — otherwise there are no tools to call.
    let calls = structured
    let visible = content
    let sawMarkup = false
    if (calls.length === 0 && hasWorkspace) {
      const parsed = extractTextToolCalls(content)
      calls = parsed.calls
      // Always adopt the cleaned text: it has any tool markup stripped, so a
      // malformed <tool_call> blob never leaks into the chat.
      visible = parsed.cleaned
      sawMarkup = parsed.sawMarkup
    }

    if (visible.trim()) emit({ type: 'content', text: visible })

    if (calls.length === 0) {
      // The model tried to call a tool but we couldn't parse it (e.g. unescaped
      // newlines the repair didn't rescue). Rather than silently give up — and
      // leave the file unwritten — ask it to re-emit the call, once per
      // iteration, bounded by MAX_ITERATIONS.
      if (sawMarkup) {
        messages.push({ role: 'assistant', content: visible.trim() })
        messages.push({
          role: 'user',
          content:
            'Your previous tool call could not be parsed as JSON (usually unescaped newlines or quotes inside a string value). Re-send it as a single <tool_call> containing STRICTLY valid JSON: escape every newline as \\n and every inner double-quote as \\". Do not paste the code in prose.'
        })
        continue
      }
      break // genuine plain-text answer → turn is done
    }

    // Record the assistant's tool-call turn in native shape so the model sees
    // its own call in the ongoing conversation.
    messages.push({
      role: 'assistant',
      content: visible.trim(),
      tool_calls: calls.map((c) => ({
        function: { name: c.name, arguments: safeArgs(c.arguments) }
      }))
    })

    let stopAfterCards = false
    for (const call of calls) {
      if (args.signal.aborted) return
      const parsed = safeArgs(call.arguments)
      let resultText = ''

      if (call.name === 'ask_questions' || call.name === 'propose_plan') {
        stopAfterCards = true
      }
      if (call.name === 'ask_questions') {
        const rawQs = (parsed.questions as unknown[]) ?? []
        const questions = rawQs
          .filter(
            (q): q is { id: string; text: string; options: string[] } =>
              !!q &&
              typeof q === 'object' &&
              typeof (q as { id?: unknown }).id === 'string' &&
              typeof (q as { text?: unknown }).text === 'string' &&
              Array.isArray((q as { options?: unknown }).options)
          )
          .map((q) => ({
            id: q.id,
            text: q.text,
            options: (q.options as unknown[]).map((o) => String(o)).filter(Boolean)
          }))
        emit({
          type: 'card',
          card: { type: 'question', cardId: uid(), intro: '', questions, status: 'pending' }
        })
        resultText = JSON.stringify({
          ok: true,
          displayed: true,
          note: "Questions are shown to the user as a form. End your turn — the user's answers arrive as the next message."
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
          note: 'The plan card is shown. End your turn — the user\'s decision arrives as the next message.'
        })
      } else {
        emit({
          type: 'content',
          text: `\n\n→ \`${call.name}\` ${oneLineArgs(call.name, parsed)}\n`
        })
        try {
          const r = await executeTool(args.workspaceRoot ?? null, call.name, parsed)
          if (r.edit) editsAccumulator.push(r.edit)
          resultText = JSON.stringify(r.output)
        } catch (err) {
          resultText = JSON.stringify({
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      messages.push({ role: 'tool', content: resultText.slice(0, 12000) })
    }

    if (stopAfterCards) break
  }

  if (editsAccumulator.length > 0) {
    emit({
      type: 'card',
      card: { type: 'file-edits', cardId: uid(), edits: dedupeEdits(editsAccumulator) }
    })
  }
}

/** Parse a JSON-encoded arguments string into an object, tolerating junk. */
function safeArgs(argsJson: string): Record<string, unknown> {
  try {
    const v = JSON.parse(argsJson)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
