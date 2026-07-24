// Default loopback endpoint — Ollama's OpenAI-compatible chat-completions API.
// The offline providers now drive Ollama's NATIVE /api/chat (see
// ollama-native.ts) via localNativeEndpoint(); this URL is still the canonical
// loopback origin that both endpoints are derived from.
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
 * Ollama's NATIVE chat endpoint (`/api/chat`), derived from the same
 * loopback-enforced origin as {@link localEndpoint}. Unlike the OpenAI-compat
 * `/v1` shim, the native endpoint honours a per-request `options.num_ctx`, which
 * the offline agent needs so the tool schema is never silently truncated. The
 * origin already passed the loopback check in localEndpoint(), preserving the
 * air-gap invariant.
 */
export function localNativeEndpoint(): string {
  try {
    return `${new URL(localEndpoint()).origin}/api/chat`
  } catch {
    return 'http://127.0.0.1:11434/api/chat'
  }
}
