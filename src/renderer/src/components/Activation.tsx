import { useState } from 'react'
import { OrbitLogo } from './Icons'
import type { LicenseStatus } from '@shared/types'

interface Props {
  onActivated: (status: LicenseStatus) => void
}

export function Activation({ onActivated }: Props): JSX.Element {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function activate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!key.trim()) return
    setBusy(true)
    setError(null)
    const res = await window.orbit.license.activate(key.trim())
    setBusy(false)
    if (res.ok && res.status) {
      onActivated(res.status)
    } else {
      setError(res.error ?? 'Activation failed.')
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo">
          <OrbitLogo size={150} />
        </div>
        <h1 className="welcome-title">CodeOne</h1>
        <p className="welcome-subtitle">
          Your trial has ended — activate to continue
        </p>

        <form className="auth-form" onSubmit={activate}>
          <textarea
            className="auth-input"
            placeholder="Paste your license key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            rows={3}
            autoFocus
          />
          {error && <div className="auth-error">{error}</div>}
          <button
            className="welcome-primary"
            type="submit"
            disabled={busy || !key.trim()}
          >
            {busy ? 'Activating…' : 'Activate'}
          </button>
        </form>

        <p className="welcome-subtitle" style={{ fontSize: 12, marginTop: 16 }}>
          Activation is verified entirely on your machine — no internet, nothing
          is sent anywhere. Need a key? Contact Orbit Labs.
        </p>
      </div>
    </div>
  )
}
