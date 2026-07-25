import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppSettings, Conversation, ProviderId } from '@shared/types'
import { DEFAULT_SYSTEM_PROMPT } from '@shared/types'
import { envKeyFor } from './env'

const DEFAULT_SETTINGS: AppSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultProvider: 'local',
  defaultModel: 'Orbit 1.4',
  temperature: 1,
  cloudEnabled: false,
  ui: 'fluid'
}

// Old prompts we replace on read so existing installs pick up the new default.
const LEGACY_DEFAULT_PROMPTS = new Set<string>([
  'You are OrbitCode, a helpful AI coding companion. Be concise, accurate, and pragmatic.',
  'You are CodeOne, an AI coding companion from Orbit Labs. Be concise, accurate, and pragmatic.',
  // Previous planning-phase prompt (pre-tool-form upgrade)
  `You are OrbitCode, an AI coding companion.

You ALWAYS begin every non-trivial request with a PLANNING PHASE. Do NOT start coding or editing files immediately.

PLANNING PHASE — required for every request that involves building, refactoring, or non-trivial changes:

1. Clarify the requirements before doing anything.
2. Ask the user 3–5 STRUCTURED multiple-choice questions to lock down scope. Each question MUST follow this format:

   1. <question>
      A) <option>
      B) <option>
      C) <option>
      D) Other (please specify)

3. WAIT for the user's answers.
4. Propose the architecture: list the files you would touch, the components/functions to add, the data shape, and the tradeoffs. Highlight assumptions.
5. End the proposal with: "Reply 'go' to proceed, or tell me what to change."
6. WAIT for explicit approval before making any file edits.

You may use read-only context tools (read_file, list_directory, search_files) at any time to gather information.
You must NOT use write_file, apply_patch, or delete_file until the user has approved the plan.

For trivial requests (one-line fixes, typo corrections, factual questions, "explain this code"), you may skip the structured questions but still confirm your plan in 2–3 sentences before editing.

Operating principles:
- Prioritize completeness, clarity, and scalability over speed.
- Avoid assumptions — if unsure, ask.
- Bad or rushed design is considered failure.
- Be concise in prose; favor precision over verbosity.`,
  // Pre-UI-quality prompt (form-tool version, no UI quality block)
  `You are OrbitCode, an AI coding companion.

You ALWAYS begin every non-trivial request with a PLANNING PHASE. Do NOT start coding or editing files immediately.

PLANNING PHASE — required for every request that involves building, refactoring, or non-trivial changes:

1. Clarify the requirements before doing anything.
2. If the ask_questions tool is available, CALL IT with 3–5 multiple-choice questions and end your turn. Do NOT write the questions as plain text — the tool renders an interactive form. The form auto-appends an "Other" option per question, so don't include "Other" in your options.
3. If the ask_questions tool is NOT available, fall back to plain text in this exact format:

   1. <question>
      A) <option>
      B) <option>
      C) <option>
      D) Other (please specify)

4. WAIT for the user's answers.
5. Propose the architecture: list the files you would touch, the components/functions to add, the data shape, and the tradeoffs. Highlight assumptions.
6. If the propose_plan tool is available, CALL IT with a title and one-sentence summary to request approval via Cancel/Proceed buttons. Do NOT ask the user to type "go" if the tool is available.
7. If the propose_plan tool is NOT available, end your proposal with: "Reply 'go' to proceed, or tell me what to change."
8. WAIT for explicit approval before making any file edits.

For trivial requests (one-line fixes, typo corrections, factual questions, "explain this code"), you may skip the structured questions but still confirm your plan in 2–3 sentences before editing.

Operating principles:
- Prioritize completeness, clarity, and scalability over speed.
- Avoid assumptions — if unsure, ask.
- Bad or rushed design is considered failure.
- Be concise in prose; favor precision over verbosity.`
])

function dataDir(): string {
  return app.getPath('userData')
}
function settingsPath(): string {
  return join(dataDir(), 'settings.json')
}
function secretsPath(): string {
  return join(dataDir(), 'secrets.bin')
}
function legacySecretsPaths(): string[] {
  const current = secretsPath()
  return [
    join(app.getPath('appData'), 'OrbitCode', 'secrets.bin'),
    join(app.getPath('appData'), 'orbitcode', 'secrets.bin')
  ].filter((p) => p !== current)
}
function conversationsPath(): string {
  return join(dataDir(), 'conversations.json')
}

async function readJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
async function writeJSON(path: string, value: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2))
  await fs.rename(tmp, path)
}

// ---- Settings ----
export async function getSettings(): Promise<AppSettings> {
  const stored = await readJSON<Partial<AppSettings>>(settingsPath(), {})
  const merged = { ...DEFAULT_SETTINGS, ...stored }
  // One-shot migration: if the stored prompt matches a legacy default,
  // upgrade it to the current default so existing installs adopt new
  // planning-phase behavior without manual reset.
  if (
    typeof stored.systemPrompt === 'string' &&
    (LEGACY_DEFAULT_PROMPTS.has(stored.systemPrompt) ||
      (stored.systemPrompt.startsWith('You are CodeOne') &&
        stored.systemPrompt.includes('You ALWAYS begin every non-trivial request')))
  ) {
    merged.systemPrompt = DEFAULT_SYSTEM_PROMPT
    void writeJSON(settingsPath(), merged)
  }
  return merged
}
export async function setSettings(s: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...s }
  await writeJSON(settingsPath(), next)
  return next
}

// ---- Secrets (encrypted with Electron safeStorage when available) ----
type SecretMap = Partial<Record<ProviderId, string>>

async function readSecretsRaw(): Promise<SecretMap> {
  try {
    const buf = await fs.readFile(secretsPath())
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(buf)
      return JSON.parse(decrypted) as SecretMap
    }
    return JSON.parse(buf.toString('utf8')) as SecretMap
  } catch {
    for (const path of legacySecretsPaths()) {
      try {
        const buf = await fs.readFile(path)
        if (safeStorage.isEncryptionAvailable()) {
          const decrypted = safeStorage.decryptString(buf)
          const map = JSON.parse(decrypted) as SecretMap
          await writeSecretsRaw(map)
          return map
        }
        const map = JSON.parse(buf.toString('utf8')) as SecretMap
        await writeSecretsRaw(map)
        return map
      } catch {
        /* try next legacy location */
      }
    }
    return {}
  }
}
async function writeSecretsRaw(map: SecretMap): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true })
  const json = JSON.stringify(map)
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8')
  const tmp = `${secretsPath()}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(tmp, data)
  await fs.chmod(tmp, 0o600).catch(() => undefined)
  await fs.rename(tmp, secretsPath())
}

export async function getSecret(id: ProviderId): Promise<string | null> {
  const map = await readSecretsRaw()
  if (map[id]) return map[id] ?? null
  // Fall back to env (loaded from .env or shell vars).
  return envKeyFor(id)
}
export async function getSecretSource(
  id: ProviderId
): Promise<'user' | 'env' | null> {
  const map = await readSecretsRaw()
  if (map[id]) return 'user'
  if (envKeyFor(id)) return 'env'
  return null
}
export async function setSecret(id: ProviderId, value: string): Promise<void> {
  const map = await readSecretsRaw()
  if (value) map[id] = value
  else delete map[id]
  await writeSecretsRaw(map)
}
export async function hasSecret(id: ProviderId): Promise<boolean> {
  return (await getSecret(id)) != null
}
export async function clearSecrets(): Promise<void> {
  await writeSecretsRaw({})
}

// ---- Conversations ----
export async function listConversations(): Promise<Conversation[]> {
  const arr = await readJSON<Conversation[]>(conversationsPath(), [])
  return arr.sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function saveConversation(conv: Conversation): Promise<void> {
  const list = await readJSON<Conversation[]>(conversationsPath(), [])
  const idx = list.findIndex((c) => c.id === conv.id)
  if (idx >= 0) list[idx] = conv
  else list.push(conv)
  await writeJSON(conversationsPath(), list)
}
export async function deleteConversation(id: string): Promise<void> {
  const list = await readJSON<Conversation[]>(conversationsPath(), [])
  const next = list.filter((c) => c.id !== id)
  await writeJSON(conversationsPath(), next)
}
