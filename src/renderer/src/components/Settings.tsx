import { useEffect, useState } from 'react'
import type { AppSettings, ProviderId } from '@shared/types'
import { PROVIDERS } from '@shared/providers'
import { getProfile, updateProfile, type Profile } from '../lib/profile'

interface Props {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  onReplayTour?: () => void
}

interface KeyState {
  value: string
  source: 'user' | 'env' | null
}

export function Settings({
  open,
  onClose,
  settings,
  onSettingsChange,
  onReplayTour
}: Props): JSX.Element | null {
  const [keys, setKeys] = useState<Record<ProviderId, KeyState>>({
    anthropic: { value: '', source: null },
    openai: { value: '', source: null },
    google: { value: '', source: null },
    orbit: { value: '', source: null }
  })
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt)
  const [temperature, setTemperature] = useState(settings.temperature)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSystemPrompt(settings.systemPrompt)
    setTemperature(settings.temperature)
    ;(async () => {
      const next: Record<ProviderId, KeyState> = { ...keys }
      for (const p of PROVIDERS) {
        if (p.id === 'orbit') continue
        const source = await window.orbit.secrets.source(p.id)
        next[p.id] = { value: '', source }
      }
      setKeys(next)
      const p = await getProfile()
      setProfile(p)
      setDisplayName(p?.display_name ?? '')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function saveProfile(): Promise<void> {
    setProfileSaving(true)
    const trimmed = displayName.trim()
    const next = await updateProfile({ display_name: trimmed || null })
    if (next) setProfile(next)
    setProfileSaving(false)
  }

  if (!open) return null

  async function saveKey(id: ProviderId): Promise<void> {
    const v = keys[id].value.trim()
    if (!v) return
    await window.orbit.secrets.set(id, v)
    const source = await window.orbit.secrets.source(id)
    setKeys((k) => ({ ...k, [id]: { value: '', source } }))
  }

  async function clearKey(id: ProviderId): Promise<void> {
    await window.orbit.secrets.set(id, '')
    const source = await window.orbit.secrets.source(id)
    setKeys((k) => ({ ...k, [id]: { value: '', source } }))
  }

  async function saveAndClose(): Promise<void> {
    for (const p of PROVIDERS) {
      const v = keys[p.id]?.value.trim()
      if (v) {
        await window.orbit.secrets.set(p.id, v)
      }
    }
    const next = await window.orbit.settings.set({ systemPrompt, temperature })
    onSettingsChange(next)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <h3 style={{ margin: '0 0 8px', fontSize: 13, color: '#9aa3b2' }}>
            Account
          </h3>
          {profile ? (
            <>
              <div className="field">
                <label>
                  Email <span className="tag ok">{profile.role}</span>
                </label>
                <input type="email" value={profile.email} disabled />
              </div>
              <div className="field">
                <label>Display name</label>
                <div className="row">
                  <input
                    type="text"
                    placeholder="What should we call you?"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <button
                    className="ghost-btn"
                    onClick={() => void saveProfile()}
                    disabled={
                      profileSaving ||
                      displayName.trim() === (profile.display_name ?? '')
                    }
                  >
                    {profileSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              {onReplayTour && (
                <div className="field">
                  <button className="ghost-btn" onClick={onReplayTour}>
                    Replay onboarding tour
                  </button>
                </div>
              )}
            </>
          ) : (
            <p style={{ marginTop: 0, fontSize: 12, color: '#6b7280' }}>
              Loading profile…
            </p>
          )}

          <h3 style={{ margin: '20px 0 8px', fontSize: 13, color: '#9aa3b2' }}>
            API Keys
          </h3>
          <p style={{ marginTop: 0, fontSize: 12, color: '#6b7280' }}>
            Stored locally and encrypted with your OS keychain when available.
            Keys never leave your machine except in requests to the provider.
          </p>
          {PROVIDERS.filter((p) => p.id !== 'orbit').map((p) => (
            <div className="field" key={p.id}>
              <label>
                {p.label}{' '}
                {keys[p.id]?.source === 'user' && (
                  <span className="tag ok">Saved</span>
                )}
                {keys[p.id]?.source === 'env' && (
                  <span className="tag ok">From .env</span>
                )}{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    window.orbit.app.openExternal(p.docsUrl)
                  }}
                >
                  Get key →
                </a>
              </label>
              <div className="row">
                <input
                  type="password"
                  placeholder={
                    keys[p.id]?.source === 'env'
                      ? '(using value from .env — type to override)'
                      : p.keyPlaceholder
                  }
                  value={keys[p.id]?.value ?? ''}
                  onChange={(e) =>
                    setKeys((k) => ({
                      ...k,
                      [p.id]: {
                        ...(k[p.id] ?? { source: null }),
                        value: e.target.value
                      }
                    }))
                  }
                />
                {keys[p.id]?.source === 'user' ? (
                  <button className="ghost-btn" onClick={() => clearKey(p.id)}>
                    Remove
                  </button>
                ) : (
                  <button
                    className="ghost-btn"
                    onClick={() => saveKey(p.id)}
                    disabled={!keys[p.id]?.value.trim()}
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          ))}

          <h3 style={{ margin: '20px 0 8px', fontSize: 13, color: '#9aa3b2' }}>
            Generation
          </h3>
          <div className="field">
            <label>System prompt</label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              Temperature: {temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="icon-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="send-btn" onClick={saveAndClose}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  )
}
