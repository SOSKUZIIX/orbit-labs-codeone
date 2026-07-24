import type {
  AgentMode,
  Conversation,
  ProviderId,
  UICard
} from '@shared/types'
import { MessageList } from './MessageList'
import { AgentComposer } from './AgentComposer'
import { CloseIcon, PlusIcon, HistoryIcon } from './Icons'
import { useEffect, useRef, useState } from 'react'
import { listConversations as listConversationsRemote } from '../lib/conversations'

interface Props {
  conversation: Conversation
  cloudEnabled: boolean
  busy: boolean
  queuedCount: number
  error: string | null
  composerText: string
  onComposerChange: (v: string) => void
  onSend: (textOverride?: string) => void
  onCancel: () => void
  onNewChat: () => void
  onSelectConversation: (conversation: Conversation) => void
  onModelSelect: (p: ProviderId, m: string) => void
  onModeChange: (m: AgentMode) => void
  onClose: () => void
  onRestoreCheckpoint?: (checkpointId: string) => void
  onRespondToCard?: (
    messageId: string,
    cardId: string,
    text: string,
    cardPatch: Partial<UICard>
  ) => void
  onOpenFile?: (path: string) => void
  rootPath: string | null
}

export function AgentPanel({
  conversation,
  cloudEnabled,
  busy,
  queuedCount,
  error,
  composerText,
  onComposerChange,
  onSend,
  onCancel,
  onNewChat,
  onSelectConversation,
  onModelSelect,
  onModeChange,
  onClose,
  onRestoreCheckpoint,
  onRespondToCard,
  onOpenFile,
  rootPath
}: Props): JSX.Element {
  const empty = conversation.messages.length === 0
  const mode: AgentMode = conversation.mode ?? 'agent'
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<Conversation[]>([])
  const historyRef = useRef<HTMLDivElement>(null)
  const [runtimeDown, setRuntimeDown] = useState(false)

  function checkRuntime(): void {
    void window.orbit.orbit
      .status()
      .then((s) => setRuntimeDown(!s.runtimeReachable))
      .catch(() => setRuntimeDown(true))
  }
  // Check on mount, and again whenever an error surfaces (e.g. a failed send).
  useEffect(() => {
    checkRuntime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  useEffect(() => {
    if (!historyOpen) return
    void listConversationsRemote().then(setHistory)
    function onDocClick(e: MouseEvent): void {
      if (
        historyRef.current &&
        e.target instanceof Node &&
        !historyRef.current.contains(e.target)
      ) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [historyOpen])

  const composer = (
    <AgentComposer
      value={composerText}
      onChange={onComposerChange}
      onSubmit={onSend}
      onCancel={onCancel}
      busy={busy}
      queuedCount={queuedCount}
      provider={conversation.provider}
      model={conversation.model}
      mode={mode}
      cloudEnabled={cloudEnabled}
      rootPath={rootPath}
      onModelSelect={onModelSelect}
      onModeChange={onModeChange}
      placeholder={
        mode === 'plan'
          ? 'Describe what you want — I’ll write a plan first…'
          : 'Ask anything…'
      }
    />
  )

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <div className="agent-header-title">
          <span className="panel-title">AGENT</span>
          {busy && (
            <span className="cooking-indicator" aria-label="AI is working">
              Cooking
            </span>
          )}
        </div>
        <div className="header-actions">
          <button className="ghost-icon" onClick={onNewChat} title="New chat">
            <PlusIcon size={16} />
          </button>
          <div className="history-menu-wrap" ref={historyRef}>
            <button
              className={'ghost-icon' + (historyOpen ? ' active' : '')}
              title="History"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <HistoryIcon size={16} />
            </button>
            {historyOpen && (
              <div className="history-menu">
                <div className="history-menu-header">Previous chats</div>
                {history.length === 0 ? (
                  <div className="history-empty">No saved chats yet.</div>
                ) : (
                  <div className="history-list">
                    {history.map((c) => (
                      <button
                        key={c.id}
                        className={
                          'history-item' +
                          (c.id === conversation.id ? ' active' : '')
                        }
                        onClick={() => {
                          setHistoryOpen(false)
                          onSelectConversation(c)
                        }}
                      >
                        <span className="history-title">
                          {c.title || 'New chat'}
                        </span>
                        <span className="history-meta">
                          {new Date(c.updatedAt).toLocaleString()} ·{' '}
                          {c.provider} · {c.model}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            className="ghost-icon close-x"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
      {runtimeDown && (
        <div className="runtime-banner">
          <div className="runtime-banner-text">
            <strong>Offline engine not detected.</strong> Orbit 1.4 runs its AI
            entirely on your machine via the Ollama runtime. Install it and start
            it, then recheck.
          </div>
          <div className="runtime-banner-actions">
            <button
              className="runtime-banner-btn primary"
              onClick={() =>
                window.orbit.app.openExternal('https://ollama.com/download')
              }
            >
              Install Ollama
            </button>
            <button className="runtime-banner-btn" onClick={checkRuntime}>
              Recheck
            </button>
          </div>
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}
      {empty ? (
        <div className="agent-empty">
          <div className="agent-empty-inner">
            <div className="agent-empty-brand">
              <h1 className="agent-empty-title">CodeOne</h1>
              <span>by Orbit Labs</span>
            </div>
            {composer}
          </div>
        </div>
      ) : (
        <>
          <div className="agent-messages">
            <MessageList
              messages={conversation.messages}
              streaming={busy}
              onRestoreCheckpoint={onRestoreCheckpoint}
              onRespondToCard={onRespondToCard}
              onOpenFile={onOpenFile}
            />
          </div>
          <div className="agent-composer-wrap">{composer}</div>
        </>
      )}
    </div>
  )
}
