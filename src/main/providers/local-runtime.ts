import type { StreamArgs, EmitFn } from './types'
import { streamOpenAICompatible } from './openai-core'

// Default loopback endpoint — Ollama's OpenAI-compatible chat-completions API.
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434/v1/chat/completions'

// Loopback hosts the offline providers may talk to. Node's URL parser returns
// IPv6 hosts wrapped in brackets, so include the bracketed form.
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/**
 * Resolve the local inference endpoint. Any ORBIT_LOCAL_ENDPOINT override MUST
 * point at loopback — this is the air-gap invariant. A non-loopback (or
 * malformed) override is refused and we fall back to the default, so a stray or
 * malicious .env cannot silently redirect workspace contents off-box while the
 * UI still says "offline".
 */
export function localEndpoint(): string {
  const override = process.env.ORBIT_LOCAL_ENDPOINT?.trim()
  if (!override) return DEFAULT_ENDPOINT
  try {
    const host = new URL(override).hostname.toLowerCase()
    if (LOOPBACK_HOSTS.has(host)) return override
    console.warn(
      `[local] Ignoring non-loopback ORBIT_LOCAL_ENDPOINT (host: ${host}); ` +
        'offline providers only talk to 127.0.0.1/localhost.'
    )
  } catch {
    console.warn('[local] Ignoring malformed ORBIT_LOCAL_ENDPOINT; using default.')
  }
  return DEFAULT_ENDPOINT
}

/**
 * Stream from a fully-offline local runtime (Ollama by default, or any
 * llama.cpp / LM Studio server exposing the OpenAI-compatible chat-completions
 * API) over loopback. No API key, no network egress — the user's code never
 * leaves the machine.
 *
 * NOTE: agentic tool use needs a large context. Ollama's default num_ctx
 * (2048/4096) is far too small once the tool schema + tool-use prompt are
 * injected; run the server with OLLAMA_CONTEXT_LENGTH=32768. See
 * docs/offline-setup.md.
 */
export function streamLocal(
  args: StreamArgs,
  emit: EmitFn,
  opts: { modelMap: Record<string, string>; label: string }
): Promise<void> {
  const mapped = opts.modelMap[args.model] ?? args.model
  return streamOpenAICompatible({ ...args, model: mapped }, emit, {
    endpoint: localEndpoint(),
    // Local runtimes ignore the bearer token; a placeholder keeps the shared
    // OpenAI-compatible client happy.
    apiKey: 'local',
    // Ollama's OpenAI-compatible endpoint rejects parallel_tool_calls.
    allowParallelToolCalls: false,
    label: opts.label
  })
}
