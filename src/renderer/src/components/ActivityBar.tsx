import {
  FilesIcon,
  SearchIcon,
  DebugIcon,
  SettingsIcon,
  ChatIcon
} from './Icons'

export type ActivityView = 'files' | 'search' | 'debug'

interface Props {
  active: ActivityView
  onChange: (v: ActivityView) => void
  onToggleAgent: () => void
  agentVisible: boolean
  onOpenSettings: () => void
}

interface Item {
  id: ActivityView
  label: string
  Icon: (p: { size?: number }) => JSX.Element
}

const ITEMS: Item[] = [
  { id: 'files', label: 'Explorer', Icon: FilesIcon },
  { id: 'search', label: 'Search', Icon: SearchIcon },
  { id: 'debug', label: 'Run & Debug', Icon: DebugIcon }
]

export function ActivityBar({
  active,
  onChange,
  onToggleAgent,
  agentVisible,
  onOpenSettings
}: Props): JSX.Element {
  return (
    <div className="activity-bar">
      <div className="activity-top">
        {ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={'activity-btn' + (active === id ? ' active' : '')}
            title={label}
            aria-label={label}
            onClick={() => onChange(id)}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>
      <div className="activity-bottom">
        <button
          className={'activity-btn' + (agentVisible ? ' active' : '')}
          title="Toggle Agent"
          aria-label="Toggle Agent"
          onClick={onToggleAgent}
        >
          <ChatIcon size={20} />
        </button>
        <button
          className="activity-btn"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenSettings}
          data-tour="settings"
        >
          <SettingsIcon size={20} />
        </button>
      </div>
    </div>
  )
}
