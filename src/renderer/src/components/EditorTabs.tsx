import { basename } from '../lib/path'
import type { OpenTab } from '@shared/types'
import { CloseIcon } from './Icons'

interface Props {
  tabs: OpenTab[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function EditorTabs({
  tabs,
  activePath,
  onSelect,
  onClose
}: Props): JSX.Element {
  if (tabs.length === 0) return <div className="tabs empty" />
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <div
          key={t.path}
          className={'tab' + (t.path === activePath ? ' active' : '')}
          onClick={() => onSelect(t.path)}
          title={t.path}
        >
          <span className="tab-name">{basename(t.path)}</span>
          {t.dirty && <span className="dirty-dot" aria-label="unsaved" />}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose(t.path)
            }}
            title="Close"
            aria-label="Close tab"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
