import { ipcMain, BrowserWindow, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppSettings,
  ChatEvent,
  ChatRequest,
  Conversation,
  ProviderId
} from '@shared/types'
import { getProvider } from './providers'
import { OFFLINE_PROVIDER_IDS } from '@shared/providers'
import { activateLicense, clearLicense, getLicenseStatus } from './license'
import { orbitStatus, pullOrbitModel } from './orbit-model'
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
  recentFolders,
  recordRecentFolder,
  watchWorkspace,
  unwatchWorkspace
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

function send(window: BrowserWindow, event: ChatEvent): void {
  if (window.isDestroyed()) return
  window.webContents.send(IPC.ChatEvent, event)
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

  ipcMain.handle(IPC.LicenseGet, async () => getLicenseStatus())
  ipcMain.handle(IPC.LicenseActivate, async (_e, token: string) =>
    activateLicense(token)
  )
  ipcMain.handle(IPC.LicenseClear, async () => clearLicense())

  ipcMain.handle(IPC.OrbitStatus, async () => orbitStatus())
  ipcMain.handle(IPC.OrbitDownload, async () => {
    await pullOrbitModel((p) => {
      const window = getWindow()
      if (window && !window.isDestroyed()) {
        window.webContents.send(IPC.OrbitPullEvent, p)
      }
    })
    return true
  })

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
  ipcMain.handle(IPC.FsRecordRecent, async (_e, path: string) => {
    await recordRecentFolder(path)
    return true
  })
  ipcMain.handle(IPC.FsWatch, async (_e, root: string) => {
    watchWorkspace(root, () => {
      const window = getWindow()
      if (window && !window.isDestroyed()) {
        window.webContents.send(IPC.FsChanged)
      }
    })
    return true
  })
  ipcMain.handle(IPC.FsUnwatch, async () => {
    unwatchWorkspace()
    return true
  })

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
    if (OFFLINE_PROVIDER_IDS.includes(req.provider)) {
      // Fully offline: no key, no auth, no usage gate. Both the branded Orbit
      // engine and the advanced Local provider run on a loopback runtime.
      apiKey = 'local'
    } else {
      // Cloud provider (Claude / GPT / Gemini). Hard-gated behind the opt-in
      // toggle: these send the conversation — including any workspace files the
      // agent reads — to a third-party server. This is the real enforcement;
      // the renderer only hides them from the picker.
      const settings = await getSettings()
      if (!settings.cloudEnabled) {
        send(window, {
          kind: 'error',
          requestId: req.requestId,
          message:
            'Online providers are off. Claude, GPT, and Gemini send your chat and code to their servers — turn them on in Settings → Online providers to use them.'
        })
        return
      }
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
