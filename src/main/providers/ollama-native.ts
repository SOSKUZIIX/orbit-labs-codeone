import { promises as nodeFs } from 'node:fs'
import { join as joinPath } from 'node:path'
import { request as httpRequest } from 'node:http'
import type { StreamArgs, EmitFn } from './types'
import { DEFAULT_SYSTEM_PROMPT } from '@shared/types'
import { localNativeEndpoint } from './local-runtime'
import {
  OPENAI_TOOLS,
  WRITE_TOOL_NAMES,
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
 * Compact replacement for the (huge, cloud-tuned) DEFAULT_SYSTEM_PROMPT. Small
 * local models drown in ~1,500 words of UI/SQL/deploy guidance and revert to
 * pasting code in chat; a short, imperative prompt keeps them on the tools.
 * Used only when the user hasn't customized their system prompt.
 */
const COMPACT_LOCAL_SYSTEM = `You are CodeOne, an offline AI coding agent by Orbit Labs. You BUILD real projects by creating and editing files in the user's workspace with your tools — you never just talk about code. Keep prose to 1-2 short sentences. For websites and UIs, write complete, modern, polished files (a full index.html is first-class).`

/**
 * Tool catalog + exact call format for models that do not reliably emit
 * structured `tool_calls`. Qwen2.5-Coder is trained on the <tool_call> tag
 * format; stating it explicitly — and short — dramatically improves adherence
 * on the 3B/7B tiers. We parse the tagged form, fenced JSON, and bare JSON
 * (see {@link extractTextToolCalls}).
 */
const LOCAL_TOOL_FORMAT_PROMPT = `

HOW TO CALL A TOOL — READ CAREFULLY:
To create or change files, or to run terminal commands, you MUST call a tool. NEVER paste file contents or code blocks into the chat for the user to copy — that is a failure. Emit each tool call wrapped in <tool_call></tool_call> tags containing ONLY valid JSON, for example:
<tool_call>{"name": "write_file", "arguments": {"path": "index.html", "content": "<!doctype html>\\n<html>...</html>"}}</tool_call>
<tool_call>{"name": "run_command", "arguments": {"command": "mkdir -p src/components"}}</tool_call>
Rules:
- The JSON must be strictly valid: every key and every string value in double quotes, newlines inside strings escaped as \\n, inner double quotes escaped as \\".
- Put the ENTIRE file contents in "content". Never abbreviate or write "// rest of code here".
- One tool call per file. After your tool calls, STOP — each result comes back as the next message.
- Tools: write_file(path, content) · apply_patch(path, old_text, new_text) · read_file(path) · list_directory(path) · search_files(query) · delete_file(path) · run_command(command).
- run_command runs a real shell command in the workspace root (mkdir, mv, rm, npm install, build/test, git).`

/**
 * The mode directive goes LAST in the system prompt so it is the model's most
 * recent, most authoritative instruction.
 */
function modeDirective(mode?: string): string {
  if (mode === 'plan') {
    return `\n\nYOU ARE IN PLAN MODE: do NOT write or edit files or run commands yet. If you truly need information, ask via ask_questions; otherwise call propose_plan with your approach, then STOP and wait for approval.`
  }
  return `\n\nYOU ARE IN AGENT MODE — ACT NOW. Do NOT wait for approval and do NOT call propose_plan. Immediately use write_file / apply_patch / run_command to create and edit EVERY file needed to fully satisfy the request, reading files first when unsure. Actually creating the files is your job. NEVER paste code or file contents in chat for the user to save — that is a failure. Finish with a one-line summary of what you changed.`
}

/** The mode suffixes useChat.ts appends to the system prompt. Stripped here so
 *  modeDirective() is the single source of mode truth for the local path — the
 *  renderer's plan suffix ("write a numbered plan… Reply with `go`") directly
 *  contradicts the propose_plan card flow. */
const RENDERER_MODE_SUFFIXES = [
  '\n\nYou are in PLAN MODE. Ask clarifying questions only if needed, then do not produce code or file edits yet. Instead, write a concise, numbered plan describing what you would do, the files involved, and the tradeoffs. End with "Reply with `go` to proceed." so the user can approve.',
  '\n\nYou are in AGENT MODE. Do not ask the user clarifying questions unless the request is impossible or unsafe without an answer. Make reasonable assumptions and proceed.'
]

/** First line of every stock prompt we have ever shipped — settings.json holds
 *  a frozen copy of whatever default was current at save time, so exact
 *  prefix-matching DEFAULT_SYSTEM_PROMPT goes stale the moment the default is
 *  edited. Matching the stable first-line marker keeps the compact swap
 *  working across versions. */
const STOCK_PROMPT_MARKER = 'You are CodeOne, an AI coding companion from Orbit Labs.'

/**
 * Assemble the local system prompt. If the user runs the stock system prompt
 * (current or any stale saved copy), swap it for the compact local one — the
 * stock prompt is tuned for large cloud models and overwhelms small local
 * ones. A genuinely custom prompt (one not starting with the stock header) is
 * kept as-is.
 */
export function buildLocalSystemPrompt(
  userSystem: string,
  hasWorkspace: boolean,
  mode?: string
): string {
  let base = userSystem
  for (const s of RENDERER_MODE_SUFFIXES) {
    if (base.endsWith(s)) base = base.slice(0, -s.length)
  }
  if (
    base.startsWith(DEFAULT_SYSTEM_PROMPT) ||
    base.trimStart().startsWith(STOCK_PROMPT_MARKER)
  ) {
    base = COMPACT_LOCAL_SYSTEM
  }
  if (!hasWorkspace) return base
  return base + LOCAL_TOOL_FORMAT_PROMPT + modeDirective(mode)
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
    case 'run_command':
      return isNonEmptyStr(a.command)
    case 'delete_file':
      return isNonEmptyStr(a.path)
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
  // Name-gated to real tools; prose examples are already excluded upstream
  // (bare JSON is only parsed when the reply IS the JSON object, and tagged/
  // fenced calls are an explicit call format, not explanation). argsValid
  // then rejects placeholder/incomplete arguments.
  if (typeof name !== 'string' || !TOOL_NAMES.has(name)) return null
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

/** Does this text look like a tool-call JSON envelope (whether or not it
 *  parses)? Used to route malformed attempts to salvage/retry instead of
 *  showing them to the user or harvesting them as files. */
export function looksLikeToolEnvelope(body: string): boolean {
  const t = body.trimStart()
  if (!t.startsWith('{')) return false
  const nm = t.match(/"name"\s*:\s*"?([A-Za-z_][A-Za-z0-9_]*)"?/)
  return !!nm && TOOL_NAMES.has(nm[1])
}

/**
 * Rescue a write_file emitted with structurally broken JSON — unescaped inner
 * double quotes / newlines in the content string are THE dominant small-model
 * malformation (HTML attributes, JS strings), and no generic JSON repair can
 * fix them. Anchoring on the stable envelope ("path" then "content" then the
 * closing braces) lets us recover the payload byte-for-byte.
 */
export function salvageWriteFile(
  raw: string
): { path: string; content: string } | null {
  if (!/"name"\s*:\s*"?write_file"?/.test(raw)) return null
  const pm = raw.match(/"path"\s*:\s*"([^"\n]+)"/)
  if (!pm) return null
  const cm = raw.match(/"content"\s*:\s*"([\s\S]*?)"\s*\}\s*\}\s*$/)
  if (!cm) return null
  const content = cm[1]
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
  if (!content.trim() || looksLikePlaceholder(content)) return null
  return { path: pm[1], content }
}

/** Try strict/repaired parse first; if the body is a broken write_file
 *  envelope, salvage it. Returns the call, or null. */
function toCallWithSalvage(body: string): NativeCall | null {
  const parsed = toCall(tolerantParse(body))
  if (parsed) return parsed
  const s = salvageWriteFile(body)
  if (s) {
    return {
      id: uid(),
      name: 'write_file',
      arguments: JSON.stringify({ path: s.path, content: s.content })
    }
  }
  return null
}

/**
 * Extract tool calls a model emitted as TEXT (rather than structured
 * `tool_calls`). Tries, in order: <tool_call> tags, fenced ```json blocks, then
 * — only when the reply IS the JSON object — a bare object.
 *
 * `cleaned` is the content with all tool markup removed, so raw JSON is never
 * shown to the user even when a call fails to parse. `sawMarkup` is true when
 * the model clearly ATTEMPTED a tool call (a tag or a tool-shaped fence was
 * present). `failed` counts attempted calls that could be neither parsed nor
 * salvaged — the caller tells the model to re-send those.
 */
export function extractTextToolCalls(content: string): {
  calls: NativeCall[]
  cleaned: string
  sawMarkup: boolean
  failed: number
} {
  let cleaned = content
  let sawMarkup = false
  let failed = 0

  // 1) <tool_call>...</tool_call> — Qwen's native text format. Always strip the
  //    tags (parsed or not) so a malformed blob can't leak into chat.
  const tagRe = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi
  const tagged: string[] = []
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(content))) tagged.push(m[1])
  if (tagged.length) {
    sawMarkup = true
    cleaned = content.replace(tagRe, '').trim()
    const calls: NativeCall[] = []
    for (const t of tagged) {
      const call = toCallWithSalvage(t)
      if (call) calls.push(call)
      else failed++
    }
    if (calls.length) return { calls, cleaned, sawMarkup, failed }
  }

  // 2) fenced ```json / ```tool_call blocks that are (or try to be) calls.
  const fenceRe = /```(?:json|tool_call)?\s*([\s\S]*?)```/gi
  const fenceCalls: NativeCall[] = []
  const fences: string[] = []
  while ((m = fenceRe.exec(content))) {
    const body = m[1]
    const call = toCallWithSalvage(body)
    if (call) {
      fenceCalls.push(call)
      fences.push(m[0])
    } else if (looksLikeToolEnvelope(body)) {
      // A malformed tool attempt in a fence: strip it (never show/harvest raw
      // envelopes) and route the caller to the retry path.
      sawMarkup = true
      failed++
      fences.push(m[0])
    }
  }
  if (fenceCalls.length || (sawMarkup && fences.length)) {
    for (const f of fences) cleaned = cleaned.replace(f, '')
    return {
      calls: fenceCalls,
      cleaned: cleaned.trim(),
      sawMarkup: sawMarkup || fenceCalls.length > 0,
      failed
    }
  }

  // 3) bare balanced JSON — ONLY when the reply STARTS with the object. This
  //    admits a real untagged call (the whole message is the JSON) while
  //    rejecting an example embedded in prose ("the format is {...}"), which
  //    would otherwise be executed and could overwrite/delete files.
  if (content.trimStart().startsWith('{')) {
    const bareCalls: NativeCall[] = []
    for (const chunk of balancedJsonObjects(content)) {
      const call = toCallWithSalvage(chunk)
      if (call) {
        bareCalls.push(call)
        cleaned = cleaned.replace(chunk, '')
      }
    }
    if (bareCalls.length) {
      return { calls: bareCalls, cleaned: cleaned.trim(), sawMarkup, failed }
    }
  }

  return { calls: [], cleaned: cleaned.trim(), sawMarkup, failed }
}

// ---------- narration harvest: turn pasted code fences into real files ----------

export interface HarvestedFile {
  path: string
  content: string
  /** True when the filename came from the model's own text (info string or a
   *  nearby mention) rather than a language default. */
  explicit: boolean
}

const FILE_EXT_RE =
  /\.(html?|css|js|mjs|cjs|jsx|ts|tsx|json|md|py|rb|go|rs|java|c|h|cpp|hpp|svg|txt|yml|yaml|toml|sql|vue|svelte|xml|sh)$/i

/** Fences that are terminal output / commands, not file contents — never
 *  harvested unless the fence info string itself names a file. */
const NON_FILE_LANGS = new Set([
  '', 'bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'text', 'txt',
  'output', 'diff', 'patch', 'plaintext'
])

const LANG_DEFAULT_NAME: Record<string, string> = {
  html: 'index.html',
  css: 'styles.css',
  javascript: 'script.js',
  js: 'script.js',
  json: 'data.json',
  python: 'main.py',
  py: 'main.py',
  typescript: 'main.ts',
  ts: 'main.ts',
  markdown: 'README.md',
  md: 'README.md',
  svg: 'image.svg'
}

/** Extensions that agree with a fence language. When the fence declares a
 *  language, a nearby-mention filename must match it — otherwise the mention
 *  is about some OTHER file ("Link styles.css from index.html:" before a js
 *  fence must not target index.html). */
const LANG_EXTS: Record<string, string[]> = {
  html: ['.html', '.htm'],
  css: ['.css'],
  javascript: ['.js', '.mjs', '.cjs', '.jsx'],
  js: ['.js', '.mjs', '.cjs', '.jsx'],
  jsx: ['.jsx', '.js'],
  typescript: ['.ts', '.tsx'],
  ts: ['.ts', '.tsx'],
  tsx: ['.tsx', '.ts'],
  json: ['.json'],
  python: ['.py'],
  py: ['.py'],
  markdown: ['.md'],
  md: ['.md'],
  svg: ['.svg'],
  yaml: ['.yml', '.yaml'],
  yml: ['.yml', '.yaml'],
  sql: ['.sql'],
  vue: ['.vue'],
  svelte: ['.svelte'],
  xml: ['.xml', '.svg']
}

interface ScannedFence {
  info: string
  code: string
  before: string
}

/** Line-based fence scanner following CommonMark closing rules: a fence opened
 *  with N backticks closes ONLY at a line of >= N backticks and nothing else.
 *  The regex approach (non-greedy to the next ```) truncated any file that
 *  itself contains fences (READMEs). Unterminated fences are dropped. */
function scanFences(content: string): ScannedFence[] {
  const lines = content.split('\n')
  const out: ScannedFence[] = []
  let beforeStart = 0
  let i = 0
  while (i < lines.length) {
    const open = lines[i].match(/^ {0,3}(`{3,})(.*)$/)
    if (!open) {
      i++
      continue
    }
    const fenceLen = open[1].length
    let j = i + 1
    let closed = false
    while (j < lines.length) {
      const close = lines[j].match(/^ {0,3}(`{3,})\s*$/)
      if (close && close[1].length >= fenceLen) {
        closed = true
        break
      }
      j++
    }
    if (!closed) break // unterminated → not a harvestable file
    out.push({
      info: (open[2] ?? '').trim(),
      code: lines.slice(i + 1, j).join('\n'),
      before: lines.slice(beforeStart, i).join('\n')
    })
    beforeStart = j + 1
    i = j + 1
  }
  return out
}

/**
 * LAST-RESORT deterministic fallback: when the model ignored every tool-call
 * format and simply pasted code fences into chat ("narrating"), extract the
 * files it obviously meant to create so they land in the workspace anyway.
 * Filename resolution, most to least reliable:
 *   1. the fence info string (```index.html or ```html:index.html)
 *   2. a filename mentioned in the text just before the fence — only if its
 *      extension agrees with the fence language
 *   3. a per-language default name (index.html, styles.css, …)
 * Shell/output fences are never treated as files unless named by (1).
 * NOTE: the caller must treat ALL harvested files as CREATE-ONLY — a quoted
 * snippet near a filename mention is indistinguishable from file content, so
 * harvest must never overwrite existing user files.
 */
export function harvestNarratedFiles(content: string): HarvestedFile[] {
  const out: HarvestedFile[] = []
  const used = new Set<string>()
  for (const fence of scanFences(content)) {
    const { info, code, before } = fence
    // Never harvest a malformed tool-call envelope as a file.
    if (looksLikeToolEnvelope(code)) continue
    // Never write abbreviated placeholder content ("// rest of code here").
    if (looksLikePlaceholder(code)) continue

    let path: string | null = null
    let explicit = false

    // 1) filename in the fence info string.
    const infoTokens = info.split(/[\s:]+/).filter(Boolean)
    for (const t of infoTokens) {
      if (FILE_EXT_RE.test(t)) {
        path = t
        explicit = true
        break
      }
    }
    const lang = infoTokens[0]?.toLowerCase() ?? ''

    if (!path) {
      // Never harvest shell/output fences on the strength of nearby text.
      if (NON_FILE_LANGS.has(lang)) continue
      // 2) filename mentioned shortly before the fence ("Create `index.html`:").
      let nearby = before.slice(-400)
      // If the window bisected a token, drop the partial word at its start.
      if (before.length > 400) nearby = nearby.replace(/^\S+/, '')
      const allowedExts = LANG_EXTS[lang]
      const mentions = [
        ...nearby.matchAll(
          /(?:^|[\s`"'*(_])([\w-]+(?:[/.\\][\w-]+)*\.[A-Za-z0-9]{1,8})(?=[\s`"'*)_:,.]|$)/g
        )
      ]
        .map((x) => x[1])
        .filter((t) => FILE_EXT_RE.test(t))
        // Extension must agree with the declared fence language.
        .filter(
          (t) =>
            !allowedExts ||
            allowedExts.some((ext) => t.toLowerCase().endsWith(ext))
        )
      if (mentions.length) {
        path = mentions[mentions.length - 1]
        explicit = true
      }
    }
    if (!path) {
      // 3) language default.
      const d = LANG_DEFAULT_NAME[lang]
      if (!d) continue
      path = d
    }

    // Normalize windows-style separators, then sanitize.
    path = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '')
    if (path.includes('..')) continue
    // A tiny unnamed snippet is an inline example, not a file.
    if (!explicit && code.trim().length < 40) continue
    if (!code.trim()) continue
    if (used.has(path)) continue
    used.add(path)
    out.push({ path, content: code.replace(/\s+$/, '') + '\n', explicit })
  }
  return out
}

// ---------- native /api/chat streaming ----------

/** Stream one native /api/chat completion, buffering content (so tool-call
 *  JSON never leaks into the final message) and capturing any structured
 *  tool_calls. `onDelta` receives raw tokens as they stream — surfaced as the
 *  "thinking" channel so slow local models show live progress instead of a
 *  frozen UI. */
const LOOPBACK_HOSTS_NATIVE = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

async function callOllama(
  endpoint: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onDelta?: (text: string) => void
): Promise<{ content: string; toolCalls: NativeCall[]; done: boolean }> {
  // node:http instead of fetch: undici's fetch enforces a 5-minute
  // headers timeout, and on CPU-only machines a long conversation can take
  // longer than that in prompt evaluation before Ollama sends its first byte —
  // killing the request with "fetch failed" mid-generation. Loopback-only is
  // asserted here directly (localNativeEndpoint() already guarantees it; this
  // is defense in depth for the air-gap invariant).
  const url = new URL(endpoint)
  if (!LOOPBACK_HOSTS_NATIVE.has(url.hostname.toLowerCase())) {
    throw new Error(`local: refusing non-loopback endpoint ${url.hostname}`)
  }

  const payload = JSON.stringify(body)
  let content = ''
  const toolCalls: NativeCall[] = []
  let sawDone = false

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errBody = ''
          res.on('data', (d: Buffer) => {
            if (errBody.length < 4096) errBody += d.toString()
          })
          res.on('end', () =>
            rejectPromise(new Error(`local ${res.statusCode}: ${errBody || res.statusMessage}`))
          )
          return
        }
        let buf = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          if (signal.aborted) {
            req.destroy()
            return
          }
          buf += chunk
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
            if (j.error) {
              req.destroy()
              rejectPromise(new Error(`local: ${j.error}`))
              return
            }
            const msg = j.message
            if (msg?.content) {
              content += msg.content
              onDelta?.(msg.content)
            }
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
        })
        res.on('end', () => resolvePromise())
        res.on('error', rejectPromise)
      }
    )
    req.on('error', (err) => {
      // Match the phrasing local.ts detects for its friendly
      // "install Ollama" message.
      rejectPromise(
        /ECONNREFUSED/i.test(String(err))
          ? new Error(`fetch failed: ${err.message}`)
          : err
      )
    })
    const onAbort = (): void => {
      req.destroy()
      resolvePromise() // aborted mid-stream: return what we have; caller checks signal
    }
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
    req.end(payload)
  })

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
  const finalSys = buildLocalSystemPrompt(
    args.systemPrompt ?? '',
    hasWorkspace,
    args.mode
  )
  if (finalSys) messages.push({ role: 'system', content: finalSys })
  for (const msg of args.messages) {
    if (msg.role === 'system') continue
    messages.push({ role: msg.role, content: msg.content })
  }

  const temperature = Math.min(args.temperature ?? 0.3, LOCAL_TEMPERATURE_CAP)

  // Pinned LAST in every request: small models weight the end of the context
  // far more than the front, and a conversation whose history contains old
  // refusals or pasted-code answers steers them to imitate those instead of
  // the system prompt. This reminder outranks the history by recency.
  const CAPABILITY_REMINDER: NativeMsg = {
    role: 'system',
    content:
      'REMINDER: You DO have direct access to the user\'s workspace through your tools: write_file, apply_patch, read_file, list_directory, search_files, delete_file, run_command (shell). Use them to actually perform what the user asks — create, edit, delete, run. NEVER say you lack access, and NEVER tell the user to do it themselves or paste code for them to copy. Ignore any earlier messages in this conversation that did so.'
  }

  let markupRetries = 0
  let refusalRetries = 0
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (args.signal.aborted) return

    const body: Record<string, unknown> = {
      model,
      // The reminder is appended per-request (not stored in `messages`) so it
      // is always the trailing message and never duplicates in history.
      messages: hasWorkspace ? [...messages, CAPABILITY_REMINDER] : messages,
      stream: true,
      keep_alive: '10m',
      options: { num_ctx: LOCAL_NUM_CTX, temperature }
    }
    if (hasWorkspace) body.tools = OPENAI_TOOLS

    const { content, toolCalls: structured } = await callOllama(
      endpoint,
      body,
      args.signal,
      // Live raw tokens on the thinking channel: slow local models otherwise
      // look frozen for minutes while the reply is buffered for parsing.
      (t) => emit({ type: 'thinking', text: t })
    )
    if (args.signal.aborted) return

    // Prefer structured tool_calls; fall back to parsing them out of the text
    // (what the 3B/7B tiers actually do). Only text-parse when a workspace is
    // open — otherwise there are no tools to call.
    let calls = structured
    let visible = content
    let sawMarkup = false
    let failedCalls = 0
    if (calls.length === 0 && hasWorkspace) {
      const parsed = extractTextToolCalls(content)
      calls = parsed.calls
      // Always adopt the cleaned text: it has any tool markup stripped, so a
      // malformed <tool_call> blob never leaks into the chat.
      visible = parsed.cleaned
      sawMarkup = parsed.sawMarkup
      failedCalls = parsed.failed
    }

    // "As an AI language model I can't delete files…" — a capability refusal
    // while the tools are RIGHT THERE. Don't show it; correct the model and
    // retry once. (Common when the chat history predates tool support.)
    const isRefusal =
      hasWorkspace &&
      args.mode !== 'plan' &&
      calls.length === 0 &&
      /as an ai\b|language model|don'?t have (direct )?access|do not have (direct )?access|(cannot|can'?t|unable to) (directly )?(access|delete|create|modify|remove|write|run|execute)|open a terminal|use the `?rm`? command/i.test(
        content
      )
    if (isRefusal && refusalRetries < 1) {
      refusalRetries++
      messages.push({ role: 'assistant', content: visible.trim() })
      messages.push({
        role: 'user',
        content:
          'Wrong — you DO have workspace access via your tools. Perform my request NOW by emitting the tool call(s): use delete_file(path) or run_command(command) for deletions, write_file(path, content) for files. Reply ONLY with <tool_call> tags.'
      })
      continue
    }

    if (visible.trim() && !isRefusal) emit({ type: 'content', text: visible })
    else if (visible.trim() && isRefusal) {
      // Second refusal in a row: show it, but append an honest pointer so the
      // user isn't left thinking the app can't do it.
      emit({
        type: 'content',
        text:
          visible +
          '\n\nⓘ CodeOne note: the offline model refused even though workspace tools are available. Try rephrasing as a direct instruction (e.g. "delete old.txt"), or start a fresh chat — old conversations can steer the model into outdated habits.'
      })
    }

    if (calls.length === 0) {
      // The model tried to call a tool but we couldn't parse or salvage it.
      // Ask it to re-emit — but only twice: on slow hardware every retry costs
      // minutes, and a model that failed twice will keep failing. After the
      // cap we fall through to the harvest so the work isn't lost.
      if (sawMarkup && markupRetries < 2) {
        markupRetries++
        messages.push({ role: 'assistant', content: visible.trim() })
        messages.push({
          role: 'user',
          content:
            'Your previous tool call could not be parsed as JSON (usually unescaped newlines or quotes inside a string value). Re-send it as a single <tool_call> containing STRICTLY valid JSON: escape every newline as \\n and every inner double-quote as \\". Do not paste the code in prose.'
        })
        continue
      }

      // LAST RESORT — the model narrated: it pasted code fences instead of
      // calling any tool (or kept mangling its tool calls past the retry cap).
      // Deterministically harvest those fences into real files so the user
      // still gets a working project on disk. Agent mode only: in plan mode
      // pasted code is part of the plan, not a deliverable.
      if (hasWorkspace && args.mode !== 'plan') {
        const harvested = harvestNarratedFiles(content)
        const written: string[] = []
        const skipped: string[] = []
        for (const f of harvested) {
          if (args.signal.aborted) return
          try {
            // CREATE-ONLY, always: a fence attributed to an existing file may
            // be a quoted snippet of it (Q&A, "here's what I changed"), and
            // overwriting real files from a heuristic is unacceptable. New
            // files can't lose data; existing files are the model's job via
            // real tools.
            const exists = await nodeFs
              .access(joinPath(args.workspaceRoot ?? '', f.path))
              .then(() => true)
              .catch(() => false)
            if (exists) {
              skipped.push(f.path)
              continue
            }
            emit({ type: 'content', text: `\n\n→ \`write_file\` ${f.path} (saved from the code above)\n` })
            const r = await executeTool(args.workspaceRoot ?? null, 'write_file', {
              path: f.path,
              content: f.content
            })
            if (r.edit) editsAccumulator.push(r.edit)
            written.push(f.path)
          } catch {
            /* skip files that fail (path outside workspace etc.) */
          }
        }
        if (written.length) {
          emit({
            type: 'content',
            text: `\n\n✓ Saved to your workspace: ${written.join(', ')}`
          })
        }
        if (skipped.length) {
          emit({
            type: 'content',
            text: `\n\nⓘ Not auto-saved (file already exists — apply the changes with the edit tools or review manually): ${skipped.join(', ')}`
          })
        }
      }
      break // turn is done
    }

    // Some calls parsed and ran, but others were mangled beyond salvage: tell
    // the model which count failed so it re-sends them next round.
    if (failedCalls > 0) {
      messages.push({
        role: 'user',
        content: `${failedCalls} of your tool calls could not be parsed and were NOT executed. After the results below, re-send ONLY the failed call(s) as <tool_call> tags with strictly valid JSON (newlines as \\n, inner quotes as \\").`
      })
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
      } else if (args.mode === 'plan' && WRITE_TOOL_NAMES.has(call.name)) {
        // Plan-mode gating enforced in CODE, not just prompt: no mutations
        // until the user approves the plan.
        resultText = JSON.stringify({
          error:
            'Blocked: you are in PLAN MODE. Present your plan with propose_plan and wait for the user to proceed before writing files or running commands.'
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
