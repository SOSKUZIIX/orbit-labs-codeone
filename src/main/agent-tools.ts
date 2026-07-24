import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { searchFiles } from './search'

interface ShellResult {
  exitCode: number
  timedOut: boolean
  stdout: string
  stderr: string
}

/**
 * Run a shell command with a REAL timeout: the child is spawned detached (its
 * own process group on POSIX) and on timeout the whole group is killed —
 * `exec`'s built-in timeout only signals the direct shell, orphaning grand-
 * children like dev servers, which then hold their ports forever.
 */
function runShell(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<ShellResult> {
  return new Promise((resolvePromise) => {
    const isWin = process.platform === 'win32'
    const child = isWin
      ? spawn('cmd.exe', ['/d', '/s', '/c', command], { cwd, windowsHide: true })
      : spawn('/bin/sh', ['-c', command], { cwd, detached: true })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const MAX = 4 * 1024 * 1024
    child.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < MAX) stdout += d.toString()
    })
    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < MAX) stderr += d.toString()
    })
    const killTree = (): void => {
      try {
        if (!isWin && child.pid) process.kill(-child.pid, 'SIGKILL')
        else if (child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      } catch {
        try {
          child.kill('SIGKILL')
        } catch {
          /* already gone */
        }
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      killTree()
    }, timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: 1, timedOut, stdout, stderr: stderr || err.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: code ?? (timedOut ? 124 : 1), timedOut, stdout, stderr })
    })
  })
}

export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'list_directory'
  | 'search_files'
  | 'delete_file'
  | 'apply_patch'
  | 'run_command'

export interface ToolEdit {
  path: string
  action: 'created' | 'modified' | 'deleted'
}

export interface ToolResult {
  output: unknown
  edit?: ToolEdit
}

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_TOOL_OUTPUT = 16 * 1024

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'out',
  'build',
  '.cache'
])

function withinRoot(root: string, p: string): boolean {
  const r = resolve(root)
  const target = resolve(p)
  const rel = relative(r, target)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`..${sep}`))
}

function resolvePath(workspaceRoot: string, raw: string): string {
  const abs = resolve(workspaceRoot, raw)
  if (!withinRoot(workspaceRoot, abs)) {
    throw new Error(`Path outside workspace: ${raw}`)
  }
  return abs
}

function relForDisplay(workspaceRoot: string, abs: string): string {
  const rel = relative(workspaceRoot, abs)
  return rel || abs
}

function clip(s: string, max = MAX_TOOL_OUTPUT): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…[truncated ${s.length - max} bytes]`
}

/** Tools that mutate the workspace or machine state. Callers enforce
 *  plan-mode gating IN CODE against this list, not just in the prompt. */
export const WRITE_TOOL_NAMES = new Set<string>([
  'write_file',
  'apply_patch',
  'delete_file',
  'run_command'
])

/**
 * Commands the agent may never run, regardless of what the model asks for.
 *
 * HONESTY NOTE: this is a best-effort BACKSTOP against the model reaching for
 * obviously catastrophic or exfiltrating commands — it is NOT a sandbox and
 * cannot be one at the string level (interpreters like `node -e` / `python -c`
 * can do anything and are essential dev tools, so they stay allowed). The
 * command runs with the user's own privileges in the workspace, exactly like
 * the in-app terminal. See docs/threat-model.md. Returns a human-readable
 * reason, or null if the command is allowed.
 */
export function blockedCommandReason(command: string): string | null {
  const c = command.toLowerCase()
  // A separator class that survives quoting/substitution tricks: anything that
  // is not part of a plain word means "start of a command token" (catches
  // `/usr/bin/curl`, `\curl`, `"curl"`, `$(curl ...)`, backticks, pipes).
  const SEP = String.raw`(?:^|[^a-z0-9_-])`
  if (new RegExp(SEP + String.raw`sudo\b`).test(c)) {
    return 'privilege escalation (sudo) is not allowed'
  }
  if (new RegExp(SEP + String.raw`(shutdown|reboot|halt|poweroff)\b`).test(c)) {
    return 'system power commands are not allowed'
  }
  if (/\b(mkfs|diskutil\s+erase|fdisk|dd\s+if=|format\s+[a-z]:)/.test(c)) {
    return 'disk-level commands are not allowed'
  }
  if (/:\s*\(\s*\)\s*\{.*\|.*&\s*\}\s*;?\s*:/.test(c)) return 'fork bomb'
  // rm aimed at the filesystem root or the home directory — including glob
  // variants (/*, ~/*, $HOME/*) and long flags (--recursive --force).
  if (
    /(^|[\s;|&])rm\s+(-{1,2}[a-z-]+\s+)*["']?(\/|~|\$home)["']?\/?\*?["']?(\s|$|;)/i.test(
      command
    )
  ) {
    return 'deleting the filesystem root or home directory is not allowed'
  }
  // `cd / && rm -rf *` style: changing to a root-ish dir then bulk-deleting.
  if (/cd\s+["']?(\/|~|\$home)["']?\s*(&&|;)[\s\S]*\brm\s/i.test(command)) {
    return 'changing to the filesystem root or home and deleting is not allowed'
  }
  // Windows catastrophic deletes / format (exec uses cmd.exe there).
  if (/(^|[\s;|&])(del|erase)\s+(\/[a-z]\s+)*\/s\b/i.test(command)) {
    return 'recursive delete via del /s is not allowed'
  }
  if (/(^|[\s;|&])(rd|rmdir)\s+\/s\b/i.test(command)) {
    return 'recursive rmdir /s is not allowed'
  }
  // Network exfiltration primitives — this is an offline-first product; the
  // agent must not move workspace data off the machine. Package managers
  // (npm/pip/etc.) are allowed: dependency installs are a normal dev need.
  if (
    new RegExp(
      SEP + String.raw`(curl|wget|nc|ncat|netcat|ssh|scp|sftp|rsync|ftp|telnet)\b`
    ).test(c)
  ) {
    return 'network transfer commands are not allowed from the agent (use package managers like npm instead)'
  }
  if (/\/dev\/tcp\//.test(c)) return 'raw TCP redirection is not allowed'
  // Windows download LOLBins + PowerShell web primitives.
  if (
    /\b(certutil|bitsadmin|start-bitstransfer|invoke-webrequest|invoke-restmethod|downloadfile|downloadstring|net\.webclient)\b/.test(
      c
    )
  ) {
    return 'network download commands are not allowed from the agent'
  }
  return null
}

export async function executeTool(
  workspaceRoot: string | null,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!workspaceRoot) {
    throw new Error(
      'No workspace folder is open. Ask the user to open one before calling tools.'
    )
  }

  switch (name) {
    case 'read_file': {
      const path = String(args.path ?? '')
      if (!path) throw new Error('read_file requires "path"')
      const abs = resolvePath(workspaceRoot, path)
      const stat = await fs.stat(abs)
      if (!stat.isFile()) throw new Error(`Not a file: ${path}`)
      if (stat.size > MAX_FILE_BYTES) {
        throw new Error(`File too large (${stat.size} bytes): ${path}`)
      }
      const content = await fs.readFile(abs, 'utf8')
      return {
        output: {
          path: relForDisplay(workspaceRoot, abs),
          bytes: stat.size,
          content: clip(content)
        }
      }
    }

    case 'write_file': {
      const path = String(args.path ?? '')
      // A weak model may hand back `content` as an object/array (e.g. for a JSON
      // file) instead of a string. String()-coercing that writes the literal
      // "[object Object]" to disk; serialize structured content as JSON instead.
      const rawContent = args.content
      const content =
        typeof rawContent === 'string'
          ? rawContent
          : rawContent == null
            ? ''
            : typeof rawContent === 'object'
              ? JSON.stringify(rawContent, null, 2)
              : String(rawContent)
      if (!path) throw new Error('write_file requires "path"')
      const abs = resolvePath(workspaceRoot, path)
      let action: 'created' | 'modified' = 'created'
      try {
        await fs.access(abs)
        action = 'modified'
      } catch {
        /* missing → created */
      }
      await fs.mkdir(dirname(abs), { recursive: true })
      await fs.writeFile(abs, content, 'utf8')
      return {
        output: {
          ok: true,
          path: relForDisplay(workspaceRoot, abs),
          bytesWritten: Buffer.byteLength(content, 'utf8'),
          action
        },
        edit: { path: abs, action }
      }
    }

    case 'apply_patch': {
      // Targeted edit: replace `oldText` with `newText` in `path`.
      const path = String(args.path ?? '')
      const oldText = String(args.old_text ?? args.oldText ?? '')
      const newText = String(args.new_text ?? args.newText ?? '')
      if (!path || !oldText) {
        throw new Error('apply_patch requires "path" and "old_text"')
      }
      const abs = resolvePath(workspaceRoot, path)
      const current = await fs.readFile(abs, 'utf8')
      const idx = current.indexOf(oldText)
      if (idx < 0) {
        throw new Error(
          `apply_patch: old_text not found in ${path}. The file may have changed; try reading it first.`
        )
      }
      const last = current.lastIndexOf(oldText)
      if (last !== idx) {
        throw new Error(
          `apply_patch: old_text appears multiple times in ${path}; include more surrounding context to disambiguate.`
        )
      }
      const next = current.slice(0, idx) + newText + current.slice(idx + oldText.length)
      await fs.writeFile(abs, next, 'utf8')
      return {
        output: {
          ok: true,
          path: relForDisplay(workspaceRoot, abs),
          replacedAt: idx
        },
        edit: { path: abs, action: 'modified' }
      }
    }

    case 'delete_file': {
      const path = String(args.path ?? '')
      if (!path) throw new Error('delete_file requires "path"')
      const abs = resolvePath(workspaceRoot, path)
      await fs.unlink(abs)
      return {
        output: { ok: true, path: relForDisplay(workspaceRoot, abs) },
        edit: { path: abs, action: 'deleted' }
      }
    }

    case 'list_directory': {
      const path = String(args.path ?? '.')
      const abs = resolvePath(workspaceRoot, path)
      const entries = await fs.readdir(abs, { withFileTypes: true })
      const out = entries
        .filter((e) => !IGNORE_DIRS.has(e.name))
        .map((e) => ({
          name: e.name,
          kind: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other'
        }))
        .slice(0, 200)
      return {
        output: { path: relForDisplay(workspaceRoot, abs), entries: out }
      }
    }

    case 'search_files': {
      const query = String(args.query ?? '')
      if (!query) throw new Error('search_files requires "query"')
      const caseSensitive = Boolean(args.case_sensitive ?? args.caseSensitive)
      const hits = await searchFiles(workspaceRoot, query, caseSensitive)
      return {
        output: {
          hits: hits.slice(0, 50).map((h) => ({
            path: relForDisplay(workspaceRoot, h.path),
            line: h.line,
            preview: h.preview
          })),
          totalHits: hits.length
        }
      }
    }

    case 'run_command': {
      const command = String(args.command ?? '').trim()
      if (!command) throw new Error('run_command requires "command"')
      const blocked = blockedCommandReason(command)
      if (blocked) {
        throw new Error(`Command refused: ${blocked}`)
      }
      // Package installs legitimately take a while; everything else gets a
      // tight leash so a hung command can't wedge the agent loop.
      const isInstall = /^\s*(npm|pnpm|yarn|bun)\b[\s\S]*\b(install|ci|add|create)\b/.test(
        command
      )
      const timeout = isInstall ? 600_000 : 120_000
      const r = await runShell(command, workspaceRoot, timeout)
      return {
        output: {
          exitCode: r.exitCode,
          timedOut: r.timedOut,
          stdout: clip(r.stdout, 8000),
          stderr: clip(r.stderr, 4000)
        }
      }
    }
  }

  throw new Error(`Unknown tool: ${name}`)
}

// ---------- Provider-specific tool catalogs ----------

export const OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'ask_questions',
      description:
        'Show the user an interactive multiple-choice form to gather requirements. Use this in the planning phase INSTEAD of writing questions as plain text in your reply. Call this once with 3–5 questions, then end your turn — the user\'s answers will arrive as the next user message. The form automatically appends an "Other" option per question; do not include "Other" in your options array.',
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: 'Between 3 and 5 questions.',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Short stable id, e.g. "q1", "q2".'
                },
                text: {
                  type: 'string',
                  description: 'The question text shown to the user.'
                },
                options: {
                  type: 'array',
                  description:
                    '2–4 multiple-choice answer options (the UI auto-appends "Other").',
                  items: { type: 'string' }
                }
              },
              required: ['id', 'text', 'options']
            }
          }
        },
        required: ['questions']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_plan',
      description:
        'Show the user an interactive plan card with Cancel and Proceed buttons. Use this AFTER you have proposed your architecture in the chat (file list, tradeoffs, etc.) to formally request approval. End your turn after calling this — the user\'s decision will arrive as the next user message ("Proceed" or "Cancel").',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Short title for the plan, e.g. "Implementation plan".'
          },
          summary: {
            type: 'string',
            description:
              'One-sentence summary of what will be built. Shown on the card.'
          }
        },
        required: ['title', 'summary']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description:
        'Read the full text contents of a file in the user\'s workspace. Use this before editing to make sure your edit is correct.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path relative to the workspace root.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description:
        'Write a file to the workspace, creating or overwriting it. Prefer apply_patch for small edits to existing files; use this when creating new files or doing a full rewrite.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path relative to the workspace root.'
          },
          content: {
            type: 'string',
            description: 'Full contents of the file.'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'apply_patch',
      description:
        'Make a targeted edit to an existing file by replacing one occurrence of old_text with new_text. The old_text must appear exactly once in the file. Read the file first if you are unsure of its contents.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path relative to the workspace root.'
          },
          old_text: {
            type: 'string',
            description:
              'Exact substring to replace. Must occur exactly once in the file. Include enough context to be unique.'
          },
          new_text: {
            type: 'string',
            description: 'Replacement text.'
          }
        },
        required: ['path', 'old_text', 'new_text']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_file',
      description: 'Delete a file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path relative to the workspace root.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_directory',
      description:
        'List entries in a directory of the workspace. Useful for exploring unfamiliar projects.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'Directory path relative to the workspace root. Use "." for the root.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_files',
      description:
        'Search for a substring across all files in the workspace. Returns up to 50 matches with line numbers.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Substring to search for.' },
          case_sensitive: {
            type: 'boolean',
            description: 'Whether the search is case sensitive (default false).'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description:
        'Run a shell command in the workspace root and get its exit code, stdout, and stderr. Use for terminal work: creating folders, moving/deleting files, npm/yarn installs, running build or test scripts, git. Commands time out (2 min; 10 min for installs). Destructive system-level commands and network transfer tools are refused.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'The shell command to run, e.g. "mkdir -p src/components" or "npm install react".'
          }
        },
        required: ['command']
      }
    }
  }
]

export const TOOL_USE_PROMPT = `

You have tools available against the user's currently-open workspace.

CRITICAL — UI tools for the planning phase:
- ONLY use the \`ask_questions\` tool when the user explicitly switches to Plan mode or the system says you are in PLAN MODE. In normal Agent mode, do not ask clarifying questions; make a reasonable assumption and proceed.
- In PLAN MODE, use the \`ask_questions\` tool to present multiple-choice questions during the planning phase. Do NOT write questions as plain text in your reply. The tool renders an interactive form the user fills out.
- ONLY use the \`propose_plan\` tool in PLAN MODE. In normal Agent mode, do not stop for a plan approval card unless the user explicitly asks for a plan.
- After calling either of these UI tools, END YOUR TURN. Do not call any other tools in the same turn. The user's answers/decision will arrive as the next user message.
- You may emit a brief sentence of context BEFORE calling these tools (e.g. "Quick questions before I draft the plan:"), but the questions themselves must come from the tool, not from prose.

CRITICAL — write-tool gating:
- read_file, list_directory, and search_files are READ-ONLY and may be used at any time, including during the planning phase, to gather context.
- write_file, apply_patch, delete_file, and run_command are WRITE TOOLS. You MUST NOT call them until the user has approved your plan via the propose_plan card (replying "Proceed") in the current conversation.
- run_command runs a real shell command in the workspace root — use it for terminal work (mkdir, mv, rm, npm install, build/test scripts, git). Prefer delete_file for single-file deletes; use run_command for everything else the terminal would do.
- If the user replies "Cancel" to a plan card, acknowledge briefly and wait for their next instruction. Do not write anything.
- For trivial changes (typo fixes, one-line tweaks, renaming a variable), you may skip ask_questions and propose_plan and edit immediately — but still announce what you'll do in 1–2 sentences first.

ABSOLUTE RULE — NO CODE BLOCKS IN CHAT WHILE A WORKSPACE IS OPEN:

- Code blocks of 3+ lines are FORBIDDEN in your reply when a workspace is open. Pasting code in chat for the user to copy is a regression to the pre-tool-use experience and counts as a failure of the agent.
- Inline single-line snippets in backticks are fine for explanation (\`const x = 5\`).
- If you find yourself about to type \`\`\`typescript / \`\`\`python / \`\`\`tsx / \`\`\`anything followed by file content, STOP. Call write_file or apply_patch instead.
- The chat is for explanation, status, and short conceptual snippets only. Real code goes to disk via tools — always.
- If a tool call fails, surface the error and try the tool again. Do NOT fall back to chat-pasting.

When you DO write:
- Prefer apply_patch over write_file for edits to existing files.
- Read a file before editing it if you're unsure of its current contents.
- For UI, website, game, or visual-tool requests, always create or update a visible preview surface. Static work must include a complete previewable index.html or SVG. Existing app work must modify the app's actual mounted entry/components/styles, not isolated snippets. Do not leave the user with code that cannot render in the CodeOne preview or the browser.
- Simple HTML sites are first-class: create a complete index.html that renders instantly in CodeOne's in-app preview without requiring a dev server.
- Never write a placeholder preview page that says "Loading", "Starting preview", "Starting the React preview", or similar. The preview's first paint must be the actual app/site/platform UI. If a framework dev server is needed, update the framework app so its own route renders real content immediately.
- If the user message includes attached image paths, treat those files as available workspace assets. Use those paths in code, copy them into the app's public/assets folder if needed, and keep references previewable.
- For SQL/database requests, generate inspectable SQL files, migrations, seed files, and paste/run instructions for the user's preferred database. Supabase/Postgres work should usually live under supabase/migrations/*.sql or schema.sql. Do not directly operate hosted platforms unless the workspace already has approved tooling and credentials.
- For publishing requests, prepare the project for Vercel or the requested host with build scripts, deployment config only where useful, env var documentation, and a visible production route. Do not claim deployment success unless a deploy command actually completed and returned a URL.
- After writes, give a short summary of what changed.

If the user hasn't opened a workspace folder, tell them you need one before you can edit files.`

void join // keep import used (path utilities)
