import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type {
  AgentMode,
  AppSettings,
  Conversation,
  FileNode,
  LicenseStatus,
  OpenTab,
  ProviderId,
  UICard
} from '@shared/types'
import { DEFAULT_SYSTEM_PROMPT } from '@shared/types'
import { isCloudProvider } from '@shared/providers'
import { ActivityBar, type ActivityView } from './components/ActivityBar'
import { FileTree } from './components/FileTree'
import { SearchPanel } from './components/SearchPanel'
import { RunDebugPanel } from './components/RunDebugPanel'
import { EditorTabs } from './components/EditorTabs'
import { EditorActions } from './components/EditorActions'
import { Editor, languageFromPath } from './components/Editor'
import { ImagePreview } from './components/ImagePreview'
import { PreviewPanel } from './components/PreviewPanel'
import { AgentPanel } from './components/AgentPanel'
import { Terminal } from './components/Terminal'
import { StatusBar } from './components/StatusBar'
import { Welcome } from './components/Welcome'
import { Settings as SettingsModal } from './components/Settings'
import { useChat } from './hooks/useChat'
import { Onboarding } from './components/Onboarding'
import { getProfile, type Profile } from './lib/profile'
import { recordRecent } from './lib/recents'
import {
  listConversations,
  saveConversation
} from './lib/conversations'

const IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'svg',
  'avif'
])
function isImagePath(p: string): boolean {
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.has(ext)
}
function mimeFor(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'ico':
      return 'image/x-icon'
    case 'svg':
      return 'image/svg+xml'
    case 'avif':
      return 'image/avif'
    default:
      return 'application/octet-stream'
  }
}

const PREVIEW_EXTS = new Set(['html', 'htm', 'svg'])
function canPreviewPath(p: string | null): boolean {
  if (!p) return false
  const ext = p.split('.').pop()?.toLowerCase() ?? ''
  return PREVIEW_EXTS.has(ext)
}
function fileUrlFor(p: string): string {
  return `file://${encodeURI(p)}`
}
function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx >= 0 ? p.slice(0, idx) : p
}
// Injected first in the preview so it runs before any untrusted page script.
// Removes the WebRTC constructors from the preview's TOP window (a channel the
// HTTP guard can't see). Best-effort only: it does NOT cover frames the page
// itself creates, and WebRTC cannot be fully blocked in a renderer running
// untrusted scripts — see docs/threat-model.md. The definitive control is a
// network-isolated machine.
const PREVIEW_HARDENING =
  '<script>(function(){["RTCPeerConnection","webkitRTCPeerConnection","mozRTCPeerConnection","RTCDataChannel"].forEach(function(k){try{Object.defineProperty(window,k,{configurable:false,get:function(){return undefined}})}catch(e){try{window[k]=undefined}catch(_){}}})})();</script>'

function previewDocument(path: string, content: string): string {
  const head = PREVIEW_HARDENING + `<base href="${fileUrlFor(dirname(path))}/">`
  if (/<head[\s>]/i.test(content)) {
    return content.replace(/<head([^>]*)>/i, `<head$1>${head}`)
  }
  return `${head}${content}`
}
function normalizePreviewUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`
  try {
    const url = new URL(withProtocol)
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
      return url.toString()
    }
  } catch {
    return null
  }
  return null
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function emptyConversation(provider: ProviderId, model: string): Conversation {
  return {
    id: uid(),
    title: 'New chat',
    provider,
    model,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: 'agent'
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultProvider: 'orbit',
  defaultModel: 'Orbit 1.2',
  temperature: 1,
  cloudEnabled: false
}

interface AppProps {
  license: LicenseStatus
  onLicenseChange: (status: LicenseStatus) => void
}

export default function App({ license, onLicenseChange }: AppProps): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [composerText, setComposerText] = useState('')
  const [activityView, setActivityView] = useState<ActivityView>('files')
  const [explorerVisible, setExplorerVisible] = useState(true)
  const [agentVisible, setAgentVisible] = useState(true)
  const [terminalVisible, setTerminalVisible] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [rootPath, setRootPath] = useState<string | null>(null)
  const [tree, setTree] = useState<FileNode | null>(null)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)

  // Checkpoint state — keyed by id we generate before each send.
  const checkpointsRef = useRef<Map<string, { path: string; content: string }[]>>(
    new Map()
  )
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const rootPathRef = useRef(rootPath)
  rootPathRef.current = rootPath

  const [conversation, setConversation] = useState<Conversation>(() =>
    emptyConversation('orbit', 'Orbit 1.2')
  )

  const persistRef = useRef<(c: Conversation) => void>(() => {})
  persistRef.current = (c: Conversation) => {
    void saveConversation(c)
  }
  const persist = useCallback((c: Conversation) => persistRef.current(c), [])
  const chat = useChat(conversation, settings, persist)

  useEffect(() => {
    setConversation(chat.conversation)
  }, [chat.conversation])

  useEffect(() => {
    ;(async () => {
      const s = await window.orbit.settings.get()
      setSettings(s)
      setPreviewUrl(await window.orbit.app.getPreviewUrl())
      const saved = await listConversations()
      chat.setConversation(
        saved[0] ?? emptyConversation(s.defaultProvider, s.defaultModel)
      )
      if (s.lastFolder) {
        try {
          const t = await window.orbit.fs.readDir(s.lastFolder)
          setRootPath(s.lastFolder)
          setTree(t)
        } catch {
          /* missing */
        }
      }
      const p = await getProfile()
      setProfile(p)
      if (p && !p.onboarded) setShowOnboarding(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If cloud is turned off while a cloud model is selected, fall back to the
  // offline Orbit engine so the picker and the send path stay consistent.
  useEffect(() => {
    if (
      !(settings.cloudEnabled ?? false) &&
      isCloudProvider(chat.conversation.provider)
    ) {
      chat.setConversation({
        ...chat.conversation,
        provider: 'orbit',
        model: 'Orbit 1.2'
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.cloudEnabled, chat.conversation.provider])

  async function openFolder(): Promise<void> {
    const result = await window.orbit.fs.openFolder()
    if (!result) return
    setRootPath(result.root)
    setTree(result.tree)
    const next = await window.orbit.settings.set({ lastFolder: result.root })
    setSettings(next)
    void recordRecent(result.root)
  }

  async function openRecent(path: string): Promise<void> {
    try {
      const t = await window.orbit.fs.readDir(path)
      setRootPath(path)
      setTree(t)
      const next = await window.orbit.settings.set({ lastFolder: path })
      setSettings(next)
      void recordRecent(path)
    } catch {
      /* missing */
    }
  }

  async function closeWorkspace(): Promise<void> {
    const dirty = tabs.some((t) => t.kind === 'text' && t.dirty)
    if (dirty) {
      const ok = window.confirm(
        'You have unsaved changes. Close the folder anyway? Your changes will be lost.'
      )
      if (!ok) return
    }
    setRootPath(null)
    setTree(null)
    setTabs([])
    setActivePath(null)
    setTerminalVisible(false)
    setPreviewVisible(false)
    const next = await window.orbit.settings.set({ lastFolder: undefined })
    setSettings(next)
  }

  async function openFile(path: string): Promise<void> {
    if (!rootPath) return
    const existing = tabs.find((t) => t.path === path)
    if (existing) {
      setActivePath(path)
      return
    }
    try {
      const r = await window.orbit.fs.readFile(rootPath, path)
      if (r.encoding === 'binary') return
      if (r.encoding === 'image') {
        setTabs((cur) => [
          ...cur,
          {
            path,
            kind: 'image',
            content: r.content,
            language: r.mimeType ?? mimeFor(path),
            dirty: false
          }
        ])
      } else {
        setTabs((cur) => [
          ...cur,
          {
            path,
            kind: 'text',
            content: r.content,
            language: languageFromPath(path),
            dirty: false
          }
        ])
      }
      setActivePath(path)
    } catch (e) {
      console.error(e)
    }
  }

  function closeTab(path: string): void {
    setTabs((cur) => {
      const idx = cur.findIndex((t) => t.path === path)
      if (idx < 0) return cur
      const next = cur.filter((t) => t.path !== path)
      if (activePath === path) {
        const fallback = next[idx] ?? next[idx - 1] ?? null
        setActivePath(fallback?.path ?? null)
      }
      return next
    })
  }

  function updateTabContent(path: string, content: string): void {
    setTabs((cur) =>
      cur.map((t) =>
        t.path === path && t.kind === 'text'
          ? { ...t, content, dirty: true }
          : t
      )
    )
  }

  async function saveActive(): Promise<void> {
    if (!rootPath || !activePath) return
    const t = tabs.find((x) => x.path === activePath)
    if (!t || t.kind !== 'text') return
    await window.orbit.fs.writeFile(rootPath, activePath, t.content)
    setTabs((cur) =>
      cur.map((x) => (x.path === activePath ? { ...x, dirty: false } : x))
    )
  }

  async function saveActiveIfDirty(): Promise<void> {
    if (!rootPath || !activePath) return
    const t = tabs.find((x) => x.path === activePath)
    if (!t || t.kind !== 'text' || !t.dirty) return
    await window.orbit.fs.writeFile(rootPath, activePath, t.content)
    setTabs((cur) =>
      cur.map((x) => (x.path === activePath ? { ...x, dirty: false } : x))
    )
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const mod = navigator.platform.toLowerCase().includes('mac')
        ? e.metaKey
        : e.ctrlKey
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        void saveActive()
      } else if (mod && e.key === '`') {
        e.preventDefault()
        setTerminalVisible((v) => !v)
      } else if (mod && e.key === 'b') {
        e.preventDefault()
        setExplorerVisible((v) => !v)
      } else if (mod && e.key === 'j') {
        e.preventDefault()
        setAgentVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, tabs, rootPath])

  function handleModelSelect(provider: ProviderId, model: string): void {
    chat.setConversation({ ...chat.conversation, provider, model })
  }

  function handleModeChange(mode: AgentMode): void {
    chat.setConversation({ ...chat.conversation, mode })
  }

  function newChat(): void {
    chat.reset(settings.defaultProvider, settings.defaultModel)
    chat.setConversation({
      ...emptyConversation(settings.defaultProvider, settings.defaultModel),
      mode: chat.conversation.mode ?? 'agent'
    })
    setComposerText('')
  }

  function selectConversation(next: Conversation): void {
    if (chat.busy) chat.cancel()
    chat.setConversation(next)
    setComposerText('')
  }

  function captureCheckpoint(): string {
    const id = uid()
    const snap = tabsRef.current
      .filter((t) => t.kind === 'text')
      .map((t) => ({ path: t.path, content: t.content }))
    checkpointsRef.current.set(id, snap)
    return id
  }

  async function restoreCheckpoint(checkpointId: string): Promise<void> {
    const snap = checkpointsRef.current.get(checkpointId)
    const root = rootPathRef.current
    if (!snap || !root) return
    // Write each captured file back to disk via the existing fs IPC,
    // and update any open tabs to mirror the restored content.
    for (const entry of snap) {
      try {
        await window.orbit.fs.writeFile(root, entry.path, entry.content)
      } catch {
        /* path may have moved; skip */
      }
    }
    setTabs((cur) =>
      cur.map((t) => {
        if (t.kind !== 'text') return t
        const match = snap.find((s) => s.path === t.path)
        return match ? { ...t, content: match.content, dirty: false } : t
      })
    )
  }

  async function handleSend(textOverride?: string): Promise<void> {
    const t = (textOverride ?? composerText).trim()
    if (!t) return
    setComposerText('')
    const checkpointId = captureCheckpoint()
    await chat.send(t, {
      assistantCheckpointId: checkpointId,
      workspaceRoot: rootPath
    })
  }

  async function handleCardResponse(
    messageId: string,
    cardId: string,
    text: string,
    cardPatch: Partial<UICard>
  ): Promise<void> {
    await chat.respondToCard(
      messageId,
      cardId,
      { text, cardPatch },
      rootPath
    )
  }

  async function refreshTreeIfRoot(): Promise<void> {
    if (!rootPath) return
    try {
      const t = await window.orbit.fs.readDir(rootPath)
      setTree(t)
    } catch {
      /* ignore */
    }
  }

  // When the agent emits a file-edits card on the latest assistant message,
  // refresh the file tree so newly created files become visible.
  const lastMessageCardsKey = useMemo(() => {
    const msgs = chat.conversation.messages
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant' || !last.cards) return ''
    const fileEdits = last.cards.find((c) => c.type === 'file-edits')
    return fileEdits ? fileEdits.cardId : ''
  }, [chat.conversation.messages])

  useEffect(() => {
    if (lastMessageCardsKey) void refreshTreeIfRoot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageCardsKey])

  async function openInBrowser(): Promise<void> {
    if (activePath) {
      await saveActiveIfDirty()
      await window.orbit.app.openPath(activePath)
    } else if (previewVisible && previewUrl) {
      await window.orbit.app.openExternal(previewUrl)
    } else if (rootPath) {
      await window.orbit.app.openPath(rootPath)
    }
  }

  async function togglePreview(): Promise<void> {
    if (!previewUrl && (!activePath || !canPreviewPath(activePath))) return
    if (previewVisible) {
      setPreviewVisible(false)
      return
    }
    if (activePath && canPreviewPath(activePath)) await saveActiveIfDirty()
    setPreviewVisible(true)
  }

  async function setLocalPreviewUrl(): Promise<void> {
    const raw = window.prompt(
      'Preview URL',
      previewUrl ?? 'http://localhost:3000/'
    )
    if (raw == null) return
    const next = normalizePreviewUrl(raw)
    const saved = await window.orbit.app.setPreviewUrl(next)
    setPreviewUrl(saved)
    if (saved) setPreviewVisible(true)
  }

  function onActivityChange(v: ActivityView): void {
    if (v === activityView && explorerVisible) {
      setExplorerVisible(false)
    } else {
      setActivityView(v)
      setExplorerVisible(true)
    }
  }

  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activePath) ?? null,
    [tabs, activePath]
  )

  const showWelcome = !rootPath && tabs.length === 0
  const canOpenInBrowser = !!activePath || !!rootPath
  const activeCanPreview = canPreviewPath(activePath)
  const canPreview = activeCanPreview || !!previewUrl
  const previewDoc =
    previewVisible &&
    activePath &&
    activeCanPreview &&
    activeTab?.kind === 'text'
      ? previewDocument(activePath, activeTab.content)
      : null
  const activePreviewUrl = previewDoc ? null : previewUrl

  useEffect(() => {
    if (previewVisible && !previewUrl && !canPreviewPath(activePath)) {
      setPreviewVisible(false)
    }
  }, [activePath, previewUrl, previewVisible])

  return (
    <div className="ide">
      <ActivityBar
        active={activityView}
        onChange={onActivityChange}
        onToggleAgent={() => setAgentVisible((v) => !v)}
        agentVisible={agentVisible}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="ide-body">
        {explorerVisible && (
          <div className="sidebar-fixed">
            {activityView === 'files' && (
            <FileTree
              root={tree}
              rootPath={rootPath}
                activePath={activePath}
                onOpenFile={openFile}
                onOpenFolder={openFolder}
                onCloseFolder={closeWorkspace}
                onClose={() => setExplorerVisible(false)}
              />
            )}
            {activityView === 'search' && (
              <SearchPanel
                rootPath={rootPath}
                onOpenFile={openFile}
                onClose={() => setExplorerVisible(false)}
              />
            )}
            {activityView === 'debug' && (
              <RunDebugPanel
                rootPath={rootPath}
                onClose={() => setExplorerVisible(false)}
                onOpenTerminal={() => setTerminalVisible(true)}
                onOpenPreview={() => setPreviewVisible(true)}
              />
            )}
          </div>
        )}
        <PanelGroup direction="horizontal" className="ide-main">
          <Panel defaultSize={100} minSize={30} order={2}>
            <div className="editor-pane">
            <div className="editor-topbar">
              <EditorTabs
                tabs={tabs}
                activePath={activePath}
                onSelect={setActivePath}
                onClose={closeTab}
              />
              <EditorActions
                activePath={activePath}
                onOpenInBrowser={openInBrowser}
                onTogglePreview={() => void togglePreview()}
                onSetPreviewUrl={() => void setLocalPreviewUrl()}
                onToggleTerminal={() => setTerminalVisible((v) => !v)}
                previewOpen={previewVisible}
                terminalOpen={terminalVisible}
                canOpenInBrowser={canOpenInBrowser}
                canPreview={canPreview}
                onRestore={(path, content) => {
                  setTabs((cur) =>
                    cur.map((t) =>
                      t.path === path && t.kind === 'text'
                        ? { ...t, content, dirty: false }
                        : t
                    )
                  )
                }}
              />
            </div>
            <PanelGroup direction="vertical" className="editor-vertical">
              <Panel
                defaultSize={previewVisible || terminalVisible ? 60 : 100}
                minSize={20}
              >
                {activeTab ? (
                  activeTab.kind === 'image' ? (
                    <ImagePreview
                      path={activeTab.path}
                      content={activeTab.content}
                      mimeType={activeTab.language}
                    />
                  ) : (
                    <Editor
                      path={activeTab.path}
                      value={activeTab.content}
                      language={activeTab.language}
                      onChange={(v) => updateTabContent(activeTab.path, v)}
                    />
                  )
                ) : showWelcome ? (
                  <Welcome
                    onOpenFolder={openFolder}
                    onOpenRecent={openRecent}
                  />
                ) : (
                  <div className="editor-empty">
                    <p>
                      {rootPath
                        ? 'Select a file from the explorer.'
                        : 'Open a folder to begin.'}
                    </p>
                  </div>
                )}
              </Panel>
              {previewVisible && (activePreviewUrl || (previewDoc && activePath)) && (
                <>
                  <PanelResizeHandle className="resize-handle horizontal" />
                  <Panel defaultSize={terminalVisible ? 25 : 40} minSize={15}>
                    <PreviewPanel
                      path={activePath ?? activePreviewUrl ?? 'Preview'}
                      src={activePreviewUrl ?? undefined}
                      srcDoc={previewDoc ?? undefined}
                      onOpenInBrowser={openInBrowser}
                      onClose={() => setPreviewVisible(false)}
                    />
                  </Panel>
                </>
              )}
              {terminalVisible && (
                <>
                  <PanelResizeHandle className="resize-handle horizontal" />
                  <Panel defaultSize={previewVisible ? 25 : 35} minSize={10}>
                    <Terminal
                      cwd={rootPath}
                      onClose={() => setTerminalVisible(false)}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </div>
        </Panel>
        </PanelGroup>
        {agentVisible && (
          <div className="agent-fixed">
            <AgentPanel
              conversation={chat.conversation}
              cloudEnabled={settings.cloudEnabled ?? false}
              busy={chat.busy}
              queuedCount={chat.queuedCount}
              error={chat.error}
              composerText={composerText}
              onComposerChange={setComposerText}
              onSend={handleSend}
              onCancel={chat.cancel}
              onNewChat={newChat}
              onSelectConversation={selectConversation}
              onModelSelect={handleModelSelect}
              onModeChange={handleModeChange}
              onClose={() => setAgentVisible(false)}
              onRestoreCheckpoint={restoreCheckpoint}
              onRespondToCard={handleCardResponse}
              onOpenFile={openFile}
              rootPath={rootPath}
            />
          </div>
        )}
      </div>
      <StatusBar
        rootPath={rootPath}
        activePath={activePath}
        language={activeTab?.language ?? null}
        dirty={activeTab?.dirty ?? false}
        provider={chat.conversation.provider}
        model={chat.conversation.model}
        license={license}
      />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
        license={license}
        onLicenseChange={onLicenseChange}
        onReplayTour={() => {
          setShowSettings(false)
          setShowOnboarding(true)
        }}
      />
      {showOnboarding && profile && (
        <Onboarding
          profile={profile}
          onComplete={(next) => {
            setProfile(next)
            setShowOnboarding(false)
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </div>
  )
}
