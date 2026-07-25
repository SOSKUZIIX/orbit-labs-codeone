import type { Conversation } from '@shared/types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onOpenSettings: () => void
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onOpenSettings
}: Props): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="titlebar-drag" />
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-dot" />
          CodeOne
        </div>
        <button className="new-chat" onClick={onNew}>
          New chat
        </button>
      </div>
      <div className="conv-list">
        {conversations.length === 0 ? (
          <div style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: 12 }}>
            No conversations yet.
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              className={'conv-item' + (c.id === activeId ? ' active' : '')}
              onClick={() => onSelect(c.id)}
            >
              <div>{c.title || 'Untitled'}</div>
              <div className="meta">
                {c.provider} · {c.model}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="sidebar-footer">
        <button className="icon-btn" onClick={onOpenSettings}>
          ⚙ Settings & API keys
        </button>
      </div>
    </aside>
  )
}
