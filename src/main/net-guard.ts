import { session } from 'electron'

// Loopback hosts (any port). The local inference runtime and the in-app preview
// of localhost dev servers live here.
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

// The only external hosts the app may ever contact — the three cloud provider
// APIs, and only after the user opts into cloud (Phase 4 gate). Everything else
// is refused so a misconfigured/injected endpoint cannot exfiltrate a workspace.
const CLOUD_API_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com'
])

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Renderer + preview egress lock. The renderer (and the preview iframe, which
 * renders untrusted workspace HTML with scripts enabled) may only load local
 * schemes and loopback URLs. Any request to an external host — fetch, XHR,
 * WebSocket, image beacon, sub-resource, or iframe navigation — is cancelled.
 * This is the hard guarantee that the user's code cannot leave the machine via
 * the UI layer, even if a bug or malicious workspace file tries.
 */
function isRendererRequestAllowed(url: string): boolean {
  if (/^(file|data|blob|devtools|chrome-extension):/i.test(url)) return true
  const host = hostOf(url)
  if (!host) return false
  return LOOPBACK.has(host)
}

export function installEgressGuard(): void {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (isRendererRequestAllowed(details.url)) {
      callback({})
      return
    }
    console.warn(`[egress] blocked renderer request: ${details.url}`)
    callback({ cancel: true })
  })
}

/**
 * Main-process fetch allowlist for provider streams. Loopback (the local Orbit/
 * Local runtime) is always allowed; the three cloud API hosts are allowed
 * (reached only after the cloud opt-in gate in ChatStart). Any other host is
 * refused. All provider network calls go through here.
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const host = hostOf(url)
  if (!host || !(LOOPBACK.has(host) || CLOUD_API_HOSTS.has(host))) {
    throw new Error(`Blocked network egress to ${host ?? 'an invalid URL'}`)
  }
  // Refuse to follow redirects: the allowlist is checked once on the initial
  // URL, so a 3xx from an allowed host must not be able to send the request
  // onward to a non-allowlisted host. The provider endpoints never redirect.
  return fetch(url, { ...init, redirect: 'error' })
}
