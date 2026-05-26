import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppSettings,
  ChatEvent,
  ChatRequest,
  Conversation,
  FileNode,
  FileReadResult,
  FileSnapshot,
  ImportedAttachment,
  OpenFolderResult,
  ProviderId,
  SearchHit,
  TerminalChunk,
  UpdateInfo
} from '@shared/types'

const api = {
  secrets: {
    get: (id: ProviderId): Promise<string | null> =>
      ipcRenderer.invoke(IPC.SecretsGet, id),
    set: (id: ProviderId, value: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SecretsSet, id, value),
    has: (id: ProviderId): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SecretsHas, id),
    source: (id: ProviderId): Promise<'user' | 'env' | null> =>
      ipcRenderer.invoke(IPC.SecretsSource, id),
    clear: (): Promise<boolean> => ipcRenderer.invoke(IPC.SecretsClear)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SettingsGet),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.SettingsSet, patch)
  },
  conversations: {
    list: (): Promise<Conversation[]> =>
      ipcRenderer.invoke(IPC.ConversationsList),
    save: (conv: Conversation): Promise<boolean> =>
      ipcRenderer.invoke(IPC.ConversationsSave, conv),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.ConversationsDelete, id)
  },
  chat: {
    start: (req: ChatRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.ChatStart, req),
    cancel: (requestId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.ChatCancel, requestId),
    onEvent: (handler: (event: ChatEvent) => void): (() => void) => {
      const listener = (_e: unknown, ev: ChatEvent): void => handler(ev)
      ipcRenderer.on(IPC.ChatEvent, listener)
      return () => ipcRenderer.removeListener(IPC.ChatEvent, listener)
    }
  },
  app: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.OpenExternal, url),
    checkForUpdates: (): Promise<UpdateInfo> =>
      ipcRenderer.invoke(IPC.UpdateCheck),
    openPath: (path: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.AppOpenPath, path),
    getPreviewUrl: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.PreviewUrlGet),
    setPreviewUrl: (url: string | null): Promise<string | null> =>
      ipcRenderer.invoke(IPC.PreviewUrlSet, url),
    platform: process.platform
  },
  terminal: {
    start: (
      sessionId: string,
      cwd: string | null,
      cols?: number,
      rows?: number
    ): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TerminalStart, sessionId, cwd, cols, rows),
    write: (sessionId: string, data: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TerminalWrite, sessionId, data),
    resize: (
      sessionId: string,
      cols: number,
      rows: number
    ): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TerminalResize, sessionId, cols, rows),
    kill: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TerminalKill, sessionId),
    onEvent: (handler: (chunk: TerminalChunk) => void): (() => void) => {
      const listener = (_e: unknown, c: TerminalChunk): void => handler(c)
      ipcRenderer.on(IPC.TerminalEvent, listener)
      return () => ipcRenderer.removeListener(IPC.TerminalEvent, listener)
    }
  },
  fs: {
    openFolder: (): Promise<OpenFolderResult | null> =>
      ipcRenderer.invoke(IPC.FsOpenFolder),
    readDir: (path: string): Promise<FileNode> =>
      ipcRenderer.invoke(IPC.FsReadDir, path),
    readFile: (root: string, path: string): Promise<FileReadResult> =>
      ipcRenderer.invoke(IPC.FsReadFile, root, path),
    writeFile: (root: string, path: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.FsWriteFile, root, path, content),
    importAttachment: (
      root: string,
      fileName: string,
      dataUrl: string
    ): Promise<ImportedAttachment> =>
      ipcRenderer.invoke(IPC.FsImportAttachment, root, fileName, dataUrl),
    recentFolders: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.FsRecentFolders)
  },
  snapshots: {
    list: (path: string): Promise<FileSnapshot[]> =>
      ipcRenderer.invoke(IPC.SnapshotList, path),
    create: (path: string, content: string): Promise<FileSnapshot> =>
      ipcRenderer.invoke(IPC.SnapshotCreate, path, content),
    restore: (path: string, createdAt: number): Promise<FileSnapshot | null> =>
      ipcRenderer.invoke(IPC.SnapshotRestore, path, createdAt)
  },
  search: {
    files: (
      root: string,
      query: string,
      caseSensitive: boolean
    ): Promise<SearchHit[]> =>
      ipcRenderer.invoke(IPC.SearchFiles, root, query, caseSensitive)
  }
}

contextBridge.exposeInMainWorld('orbit', api)

export type OrbitApi = typeof api
