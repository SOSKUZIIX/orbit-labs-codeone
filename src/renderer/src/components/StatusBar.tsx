import { useEffect, useState } from 'react'
import type { UpdateInfo } from '@shared/types'
import { basename } from '../lib/path'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/profile'

interface Props {
  rootPath: string | null
  activePath: string | null
  language: string | null
  dirty: boolean
  provider: string
  model: string
}

export function StatusBar({
  rootPath,
  activePath,
  language,
  dirty,
  provider,
  model
}: Props): JSX.Element {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    function refreshUpdate(): void {
      void window.orbit.app.checkForUpdates().then(setUpdate)
    }

    refreshUpdate()
    const interval = window.setInterval(refreshUpdate, 30 * 60 * 1000)

    function refreshWhenVisible(): void {
      if (document.visibilityState === 'visible') refreshUpdate()
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    void getProfile().then((p) => setDisplayName(p?.display_name ?? null))

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  function openDownload(): void {
    void window.orbit.app.openExternal(
      update?.downloadUrl ?? 'https://codeone.orbitlabs.dev/download'
    )
  }

  return (
    <div className="status-bar">
      <button className="status-badge beta" onClick={() => setDetailsOpen(true)}>
        Beta
      </button>
      <button
        className={'status-badge update' + (update?.available ? ' available' : '')}
        onClick={() => setDetailsOpen(true)}
      >
        {update?.available ? 'Update available' : 'Updates'}
      </button>
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
      <span className="status-item dim">{provider}</span>
      <span className="status-item">{model}</span>
      {email && (
        <button
          className="status-item dim status-signout"
          title={`Signed in as ${email} — click to sign out`}
          onClick={() => void signOut()}
        >
          {displayName || email}
        </button>
      )}
      {detailsOpen && (
        <div className="update-popover">
          <div className="update-popover-title">
            {update?.available ? 'New CodeOne update' : 'CodeOne beta'}
          </div>
          <div className="update-popover-meta">
            Current {update?.currentVersion ?? '0.1.0'} · Latest{' '}
            {update?.latestVersion ?? 'checking'}
          </div>
          <ul>
            {(update?.changelog?.length
              ? update.changelog
              : ['Checking the public update feed.']
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {update?.error && (
            <div className="update-popover-error">{update.error}</div>
          )}
          <div className="update-popover-actions">
            <button className="ghost-btn" onClick={() => setDetailsOpen(false)}>
              Close
            </button>
            <button className="primary-btn small" onClick={openDownload}>
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
