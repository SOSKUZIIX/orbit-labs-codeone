import { useEffect, useState } from 'react'
import { OrbitLogo, FolderIcon, HistoryIcon } from './Icons'
import { basename } from '../lib/path'
import { listRecents } from '../lib/recents'

interface Props {
  onOpenFolder: () => void
  onOpenRecent: (path: string) => void
}

export function Welcome({ onOpenFolder, onOpenRecent }: Props): JSX.Element {
  const [recents, setRecents] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    void listRecents().then(setRecents)
  }, [])

  const visible = showAll ? recents : recents.slice(0, 3)

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo">
          <OrbitLogo size={150} />
        </div>
        <h1 className="welcome-title">CodeOne</h1>
        <p className="welcome-subtitle">by Orbit Labs</p>

        <div className="welcome-actions">
          <button
            className="welcome-primary"
            onClick={onOpenFolder}
            data-tour="open-workspace"
          >
            <FolderIcon size={15} />
            <span>Open Workspace</span>
          </button>
        </div>

        {recents.length > 0 && (
          <>
            <div className="welcome-section-title">Recent</div>
            <div className="welcome-list">
              {visible.map((p) => (
                <button
                  key={p}
                  className="welcome-item"
                  onClick={() => onOpenRecent(p)}
                  title={p}
                >
                  <HistoryIcon size={14} />
                  <div className="welcome-item-text">
                    <div className="welcome-item-name">{basename(p)}</div>
                    <div className="welcome-item-path">{p}</div>
                  </div>
                </button>
              ))}
            </div>
            {recents.length > 3 && !showAll && (
              <button className="welcome-more" onClick={() => setShowAll(true)}>
                Show More…
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
