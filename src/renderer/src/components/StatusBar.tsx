import { useEffect, useState } from 'react'
import type { LicenseStatus, ProviderId } from '@shared/types'
import { isCloudProvider, getProvider } from '@shared/providers'
import { basename } from '../lib/path'
import { getProfile } from '../lib/profile'

interface Props {
  rootPath: string | null
  activePath: string | null
  language: string | null
  dirty: boolean
  provider: string
  model: string
  license: LicenseStatus | null
}

export function StatusBar({
  rootPath,
  activePath,
  language,
  dirty,
  provider,
  model,
  license
}: Props): JSX.Element {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    void getProfile().then((p) => setDisplayName(p?.display_name ?? null))
  }, [])

  return (
    <div className="status-bar">
      <button className="status-badge beta" onClick={() => setDetailsOpen(true)}>
        Beta
      </button>
      {license?.state === 'trial' && (
        <span
          className="status-badge"
          title="Free trial — activate a license in Settings"
        >
          Trial · {license.trialDaysLeft}d
        </span>
      )}
      <span className="status-item dim">
        {rootPath ? basename(rootPath) : 'No folder'}
      </span>
      {activePath && (
        <span className="status-item">
          {basename(activePath)}
          {dirty ? ' ●' : ''}
        </span>
      )}
      <span className="status-spacer" />
      {language && <span className="status-item dim">{language}</span>}
      {isCloudProvider(provider as ProviderId) && (
        <span
          className="status-badge online"
          title="This model sends your chat and any code the agent reads to the provider's servers"
        >
          online
        </span>
      )}
      <span className="status-item dim">{getProvider(provider)?.label ?? provider}</span>
      <span className="status-item">{model}</span>
      {displayName && <span className="status-item dim">{displayName}</span>}
      {detailsOpen && (
        <div className="update-popover">
          <div className="update-popover-title">CodeOne — offline</div>
          <div className="update-popover-meta">
            Fully local · your code never leaves this machine
          </div>
          <ul>
            <li>No account, no cloud sync, no telemetry.</li>
            <li>The AI runs on your machine via the local runtime.</li>
          </ul>
          <div className="update-popover-actions">
            <button className="ghost-btn" onClick={() => setDetailsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
