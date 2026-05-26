import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from '@shared/types'

/**
 * Map of ProviderId to the env var names we'll honor (in priority order).
 * The first found wins.
 */
const ENV_KEYS: Record<ProviderId, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY'],
  orbit: []
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

/**
 * Load `.env` files from likely locations into `process.env`. Existing process
 * env vars take precedence over file values (so shell-set vars win).
 *
 * Search order:
 *   1. <userData>/.env            (persistent, per-user)
 *   2. <cwd>/.env                 (development convenience)
 *   3. <appPath>/.env             (alongside the packaged app)
 */
export function loadDotenv(): void {
  const candidates = [
    join(app.getPath('userData'), '.env'),
    join(process.cwd(), '.env'),
    join(app.getAppPath(), '.env')
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const text = readFileSync(path, 'utf8')
      const parsed = parseDotenv(text)
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v
      }
    } catch {
      /* ignore unreadable files */
    }
  }
}

export function envKeyFor(provider: ProviderId): string | null {
  for (const name of ENV_KEYS[provider] ?? []) {
    const v = process.env[name]
    if (v && v.trim()) return v.trim()
  }
  return null
}

export function userDataEnvPath(): string {
  return join(app.getPath('userData'), '.env')
}
