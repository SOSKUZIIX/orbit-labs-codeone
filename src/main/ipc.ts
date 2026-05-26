import { app, ipcMain, BrowserWindow, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppSettings,
  ChatEvent,
  ChatRequest,
  Conversation,
  ProviderId,
  UpdateInfo
} from '@shared/types'
import { getProvider } from './providers'
import { checkAndIncrementOrbitUsage } from './orbit-usage'
import {
  clearSecrets,
  deleteConversation,
  getSecret,
  getSecretSource,
  getSettings,
  hasSecret,
  listConversations,
  saveConversation,
  setSecret,
  setSettings
} from './store'
import {
  openFolderDialog,
  readDirShallow,
  readFile,
  writeFile,
  importAttachment,
  recentFolders
} from './fs'
import {
  startTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal
} from './terminal'
import { listSnapshots, recordSnapshot, restoreSnapshot } from './snapshots'
import { searchFiles } from './search'

const inflight = new Map<string, AbortController>()
let previewUrl: string | null = null
const UPDATE_FEED_URL = 'https://codeone.orbitlabs.dev/latest.json'
const DOWNLOAD_URL = 'https://codeone.orbitlabs.dev/download'

function send(window: BrowserWindow, event: ChatEvent): void {
  if (window.isDestroyed()) return
  window.webContents.send(IPC.ChatEvent, event)
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    const diff = pa.core[i] - pb.core[i]
    if (diff !== 0) return diff
  }
  if (!pa.prerelease.length && pb.prerelease.length) return 1
  if (pa.prerelease.length && !pb.prerelease.length) return -1
  const len = Math.max(pa.prerelease.length, pb.prerelease.length)
  for (let i = 0; i < len; i++) {
    const left = pa.prerelease[i]
    const right = pb.prerelease[i]
    if (left === undefined) return -1
    if (right === undefined) return 1
    const leftNum = /^\d+$/.test(left) ? Number(left) : null
    const rightNum = /^\d+$/.test(right) ? Number(right) : null
    if (leftNum !== null && rightNum !== null) {
      const diff = leftNum - rightNum
      if (diff !== 0) return diff
      continue
    }
    if (leftNum !== null) return -1
    if (rightNum !== null) return 1
    const diff = left.localeCompare(right)
    if (diff !== 0) return diff
  }
  return 0
}

function parseVersion(version: string): { core: [number, number, number]; prerelease: string[] } {
  const clean = version.trim().replace(/^v/i, '').split('+')[0]
  const [corePart, prereleasePart = ''] = clean.split('-', 2)
  const core = corePart
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0)
  while (core.length < 3) core.push(0)
  return {
    core: core as [number, number, number],
    prerelease: prereleasePart ? prereleasePart.split('.') : []
  }
}

async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(UPDATE_FEED_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`Update feed returned ${res.status}`)
    const json = (await res.json()) as Partial<UpdateInfo>
    const latestVersion = String(json.latestVersion ?? currentVersion)
    return {
      currentVersion,
      latestVersion,
      available: compareVersions(latestVersion, currentVersion) > 0,
      downloadUrl: String(json.downloadUrl ?? DOWNLOAD_URL),
      changelog: Array.isArray(json.changelog)
        ? json.changelog.map(String).filter(Boolean)
        : [],
      checkedAt: Date.now()
    }
  } catch (err) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      available: false,
      downloadUrl: DOWNLOAD_URL,
      changelog: [
        'CodeOne is in beta.',
        'Updates will appear here when the public download site publishes the latest release feed.'
      ],
      checkedAt: Date.now(),
      error: err instanceof Error ? err.message : 'Unable to check updates'
    }
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.SecretsGet, async (_e, id: ProviderId) => getSecret(id))
  ipcMain.handle(IPC.SecretsSet, async (_e, id: ProviderId, value: string) => {
    await setSecret(id, value)
    return true
  })
  ipcMain.handle(IPC.SecretsHas, async (_e, id: ProviderId) => hasSecret(id))
  ipcMain.handle(IPC.SecretsSource, async (_e, id: ProviderId) =>
    getSecretSource(id)
  )
  ipcMain.handle(IPC.SecretsClear, async () => {
    await clearSecrets()
    return true
  })

  ipcMain.handle(IPC.SettingsGet, async () => getSettings())
  ipcMain.handle(IPC.SettingsSet, async (_e, patch: Partial<AppSettings>) =>
    setSettings(patch)
  )

  ipcMain.handle(IPC.ConversationsList, async () => listConversations())
  ipcMain.handle(IPC.ConversationsSave, async (_e, conv: Conversation) => {
    await saveConversation(conv)
    return true
  })
  ipcMain.handle(IPC.ConversationsDelete, async (_e, id: string) => {
    await deleteConversation(id)
    return true
  })

  ipcMain.handle(IPC.OpenExternal, async (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url)
    return true
  })
  ipcMain.handle(IPC.UpdateCheck, async () => checkForUpdates())

  ipcMain.handle(IPC.FsOpenFolder, async () => openFolderDialog(getWindow()))
  ipcMain.handle(IPC.FsReadDir, async (_e, path: string) => readDirShallow(path))
  ipcMain.handle(IPC.FsReadFile, async (_e, root: string, path: string) =>
    readFile(root, path)
  )
  ipcMain.handle(
    IPC.FsWriteFile,
    async (_e, root: string, path: string, content: string) => {
      await writeFile(root, path, content)
      return true
    }
  )
  ipcMain.handle(
    IPC.FsImportAttachment,
    async (_e, root: string, fileName: string, dataUrl: string) =>
      importAttachment(root, fileName, dataUrl)
  )
  ipcMain.handle(IPC.FsRecentFolders, async () => recentFolders())

  ipcMain.handle(IPC.AppOpenPath, async (_e, path: string) => {
    if (!path) return false
    if (/^https?:\/\//i.test(path)) {
      await shell.openExternal(path)
    } else {
      // file:// URL → openExternal handles it; raw paths use openPath
      const err = await shell.openPath(path)
      if (err) return false
    }
    return true
  })

  ipcMain.handle(IPC.PreviewUrlGet, async () => previewUrl)
  ipcMain.handle(IPC.PreviewUrlSet, async (_e, url: string | null) => {
    const next = (url ?? '').trim()
    previewUrl = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?(\/.*)?$/i.test(next)
      ? next
      : null
    return previewUrl
  })

  ipcMain.handle(
    IPC.TerminalStart,
    async (
      _e,
      sessionId: string,
      cwd: string | null,
      cols?: number,
      rows?: number
    ) => {
      const window = getWindow()
      if (!window) return false
      startTerminal(window, sessionId, cwd, cols, rows)
      return true
    }
  )
  ipcMain.handle(
    IPC.TerminalWrite,
    async (_e, sessionId: string, data: string) => {
      writeTerminal(sessionId, data)
      return true
    }
  )
  ipcMain.handle(
    IPC.TerminalResize,
    async (_e, sessionId: string, cols: number, rows: number) => {
      resizeTerminal(sessionId, cols, rows)
      return true
    }
  )
  ipcMain.handle(IPC.TerminalKill, async (_e, sessionId: string) => {
    killTerminal(sessionId)
    return true
  })

  // ---- Snapshots / Restore ----
  ipcMain.handle(IPC.SnapshotList, async (_e, path: string) =>
    listSnapshots(path)
  )
  ipcMain.handle(
    IPC.SnapshotCreate,
    async (_e, path: string, content: string) =>
      recordSnapshot(path, content, 'manual')
  )
  ipcMain.handle(
    IPC.SnapshotRestore,
    async (_e, path: string, createdAt: number) =>
      restoreSnapshot(path, createdAt)
  )

  // ---- Search ----
  ipcMain.handle(
    IPC.SearchFiles,
    async (_e, root: string, query: string, caseSensitive: boolean) =>
      searchFiles(root, query, caseSensitive)
  )

  ipcMain.handle(IPC.ChatStart, async (_e, req: ChatRequest) => {
    const window = getWindow()
    if (!window) return
    let apiKey = ''
    if (req.provider === 'orbit') {
      const systemKey = process.env.ORBITONE_OPENAI_KEY
      if (!systemKey) {
        send(window, {
          kind: 'error',
          requestId: req.requestId,
          message:
            'Orbit 1.2 is not configured on this build. Set ORBITONE_OPENAI_KEY in .env.'
        })
        return
      }
      if (!req.authToken) {
        send(window, {
          kind: 'error',
          requestId: req.requestId,
          message: 'Sign in is required to use Orbit 1.2.'
        })
        return
      }
      try {
        const usage = await checkAndIncrementOrbitUsage(req.authToken)
        if (!usage.allowed) {
          const reset = new Date(usage.reset_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })
          send(window, {
            kind: 'error',
            requestId: req.requestId,
            message: `Orbit 1.2 usage limit reached (${usage.count}/${usage.limit}). Resets at ${reset}.`
          })
          return
        }
      } catch (err) {
        send(window, {
          kind: 'error',
          requestId: req.requestId,
          message: `Could not verify Orbit 1.2 usage: ${err instanceof Error ? err.message : String(err)}`
        })
        return
      }
      apiKey = systemKey
    } else {
      const fetched = await getSecret(req.provider)
      if (!fetched) {
        send(window, {
          kind: 'error',
          requestId: req.requestId,
          message: `No API key configured for ${req.provider}. Add one in Settings.`
        })
        return
      }
      apiKey = fetched
    }
    const controller = new AbortController()
    inflight.set(req.requestId, controller)
    try {
      const provider = getProvider(req.provider)
      await provider.stream(
        {
          apiKey,
          model: req.model,
          messages: req.messages,
          systemPrompt: req.systemPrompt,
          temperature: req.temperature,
          maxTokens: req.maxTokens,
          signal: controller.signal,
          workspaceRoot: req.workspaceRoot ?? null,
          mode: req.mode
        },
        (event) => {
          if (event.type === 'thinking') {
            send(window, {
              kind: 'thinking-delta',
              requestId: req.requestId,
              text: event.text
            })
          } else if (event.type === 'content') {
            send(window, {
              kind: 'delta',
              requestId: req.requestId,
              text: event.text
            })
          } else if (event.type === 'card') {
            send(window, {
              kind: 'card',
              requestId: req.requestId,
              card: event.card
            })
          }
        }
      )
      send(window, { kind: 'done', requestId: req.requestId })
    } catch (err) {
      if (controller.signal.aborted) {
        send(window, { kind: 'done', requestId: req.requestId })
      } else {
        const message = err instanceof Error ? err.message : String(err)
        send(window, { kind: 'error', requestId: req.requestId, message })
      }
    } finally {
      inflight.delete(req.requestId)
    }
  })

  ipcMain.handle(IPC.ChatCancel, async (_e, requestId: string) => {
    const ctrl = inflight.get(requestId)
    if (ctrl) ctrl.abort()
    return true
  })
}
