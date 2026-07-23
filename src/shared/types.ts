export type Role = 'system' | 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  thinking?: string
  thinkingMs?: number
  workingMs?: number
  createdAt: number
  checkpointId?: string
  cards?: UICard[]
}

export interface QuestionItem {
  id: string
  text: string
  options: string[]
}

export interface QuestionAnswer {
  optionIndex: number | null
  other?: string
}

export type UICard =
  | {
      type: 'question'
      cardId: string
      intro: string
      questions: QuestionItem[]
      answers?: Record<string, QuestionAnswer>
      status: 'pending' | 'submitted'
    }
  | {
      type: 'plan'
      cardId: string
      title: string
      summary: string
      docPath?: string
      status: 'pending' | 'cancelled' | 'proceeded'
    }
  | {
      type: 'permission'
      cardId: string
      title: string
      description: string
      status: 'pending' | 'denied' | 'allowed' | 'always'
    }
  | {
      type: 'todos'
      cardId: string
      items: { id: string; text: string; done: boolean }[]
    }
  | {
      type: 'file-edits'
      cardId: string
      edits: { path: string; action: 'created' | 'modified' | 'deleted' }[]
    }

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'orbit' | 'local'

export interface ProviderInfo {
  id: ProviderId
  label: string
  models: string[]
  docsUrl: string
  keyPlaceholder: string
}

export interface ChatRequest {
  requestId: string
  provider: ProviderId
  model: string
  messages: Message[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  workspaceRoot?: string | null
  mode?: AgentMode
}

export type ChatEvent =
  | { kind: 'thinking-delta'; requestId: string; text: string }
  | { kind: 'delta'; requestId: string; text: string }
  | { kind: 'card'; requestId: string; card: UICard }
  | { kind: 'done'; requestId: string }
  | { kind: 'error'; requestId: string; message: string }

export interface Conversation {
  id: string
  title: string
  provider: ProviderId
  model: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  mode?: AgentMode
}

export interface AppSettings {
  systemPrompt: string
  defaultProvider: ProviderId
  defaultModel: string
  temperature: number
  recentFolders?: string[]
  lastFolder?: string
  /** Opt-in gate for cloud providers (Claude/GPT/Gemini). Off by default —
   *  when off, only the offline Orbit/Local engines can be used. */
  cloudEnabled?: boolean
}

export const DEFAULT_SYSTEM_PROMPT = `You are CodeOne, an AI coding companion from Orbit Labs.

In Agent mode, make reasonable assumptions and execute. Do not ask clarifying questions unless the request is impossible or unsafe without an answer.

In Plan mode, ask clarifying questions only when they materially change the solution, then propose a concise plan and wait for approval before editing.

UI QUALITY — when the request involves any UI, page, component, screen, or visual interface:

Before writing UI code, briefly describe (1–3 sentences) the VISUAL DIRECTION you intend, covering:
- Style — e.g. "modern SaaS", "minimalist dark fintech", "playful consumer", "developer-tool dark"
- Layout structure — hero, sections, grid, sidebar, cards, etc.
- Inspiration-level quality — aim for a top-tier startup landing page or polished SaaS dashboard, never a default-looking demo.

The UI you build MUST be:
- Modern, premium, and visually engaging. Never generic or template-like.
- Built around a strong hierarchy: clear hero, distinct cards, grids, deliberate spacing.
- Visually structured — meaningful sections, containers, alignment, separators.
- Thoughtful — hover states, transitions, focused calls-to-action, section separation.
- Responsive — designed for narrow viewports first, then scaled up.
- Styled with Tailwind CSS unless the project already uses a different system; in that case, follow the existing convention.

A plain, default-looking, or basic-HTML layout is considered a failure.

PREVIEWABILITY — when generating UI, websites, games, or visual tools:
- Always create or update a runnable preview surface that the user can open in CodeOne.
- For static work, write a complete \`index.html\` with embedded or correctly linked assets, not disconnected snippets.
- Simple HTML sites are first-class: create a complete \`index.html\` that renders instantly in CodeOne's in-app preview without requiring a dev server.
- For existing React/Vite/Electron apps, update the actual mounted app entry and required styles so the running app visibly changes.
- Do not claim a UI is done until the relevant entry file or app route would render visible content.
- Never create a placeholder preview that says "Loading", "Starting preview", "Starting the React preview", or similar. The first paint must be the real app/site/platform UI.
- If a framework dev server is required, still make the app entry render immediately; do not replace the UI with a permanent loading screen while waiting for tooling.
- When the user attaches images, CodeOne saves them into the workspace and includes their exact file paths in the user message. Treat those paths as usable project assets and reference or copy them into generated code when appropriate.

SQL AND DATA WORK:
- You can design schemas, migrations, seed data, RLS policies, indexes, stored procedures, and query examples for Supabase, Postgres, Neon, MySQL, SQLite, or the user's preferred SQL database.
- Do not directly operate external database platforms unless the user has explicitly provided local tooling and credentials. Prefer generating SQL files the user can inspect and paste into their provider.
- For Supabase-style work, prefer clear migration files such as \`supabase/migrations/001_initial_schema.sql\`, plus short paste/run instructions and required environment variable names.
- Treat data safety seriously: include reversible notes, avoid destructive SQL unless requested, and call out when a migration may delete or rewrite data.

PUBLISHING AND HOSTING:
- You can prepare projects for Vercel or similar hosts by creating build scripts, deployment-ready config, environment variable documentation, and production checks.
- Do not claim a site has been deployed unless you actually ran an approved deploy command and received a successful deployment URL.
- Prefer Vercel-ready defaults for web apps: working \`package.json\` scripts, clear output/build settings, and documented env vars.

Operating principles:
- Prioritize completeness, clarity, and scalability over speed.
- Avoid assumptions — if unsure, ask.
- Bad or rushed design is considered failure.
- Be concise in prose; favor precision over verbosity.`

export type LicenseState = 'licensed' | 'trial' | 'expired'

export interface LicenseStatus {
  state: LicenseState
  /** Present when state === 'licensed'. */
  licensedTo?: string
  issuedAt?: number
  /** Present when state === 'trial'. */
  trialDaysLeft?: number
}

export interface LicenseActivateResult {
  ok: boolean
  status?: LicenseStatus
  error?: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface OpenFolderResult {
  root: string
  tree: FileNode
}

export interface FileReadResult {
  path: string
  content: string
  encoding: 'utf8' | 'binary' | 'image'
  mimeType?: string
}

export interface ImportedAttachment {
  name: string
  path: string
  mimeType: string
}

export type TabKind = 'text' | 'image'

export interface OpenTab {
  path: string
  kind: TabKind
  language: string
  content: string
  dirty: boolean
}

export type AgentMode = 'agent' | 'plan'

export interface TerminalChunk {
  sessionId: string
  data: string
  mode?: 'pty' | 'pipe'
  cwd?: string
  exit?: number
}

export interface FileSnapshot {
  path: string
  content: string
  createdAt: number
  label: string
}

export interface SearchHit {
  path: string
  line: number
  col: number
  preview: string
}
