import { useEffect, useState } from 'react'
import type {
  AppSettings,
  LicenseStatus,
  OrbitPullProgress,
  OrbitStatus,
  ProviderId
} from '@shared/types'
import { PROVIDERS, CLOUD_PROVIDER_IDS } from '@shared/providers'
import { getProfile, updateProfile, type Profile } from '../lib/profile'

/** "qwen2.5-coder:7b" -> "7B" for display. */
function tierLabel(tag: string): string {
  const m = tag.match(/:(\d+(?:\.\d+)?b)$/i)
  return m ? m[1].toUpperCase() : tag
}

interface Props {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  license: LicenseStatus | null
  onLicenseChange: (status: LicenseStatus) => void
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
  license,
  onLicenseChange,
  onReplayTour
}: Props): JSX.Element | null {
  const [keys, setKeys] = useState<Record<ProviderId, KeyState>>({
    anthropic: { value: '', source: null },
    openai: { value: '', source: null },
    google: { value: '', source: null },
    orbit: { value: '', source: null },
    local: { value: '', source: null }
  })
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt)
  const [temperature, setTemperature] = useState(settings.temperature)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [cloudEnabled, setCloudEnabled] = useState(settings.cloudEnabled ?? false)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseBusy, setLicenseBusy] = useState(false)
  const [licenseError, setLicenseError] = useState<string | null>(null)
  const [orbit, setOrbit] = useState<OrbitStatus | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [pull, setPull] = useState<OrbitPullProgress | null>(null)

  useEffect(() => {
    if (!open) return
    setSystemPrompt(settings.systemPrompt)
    setTemperature(settings.temperature)
    setCloudEnabled(settings.cloudEnabled ?? false)
    ;(async () => {
      const next: Record<ProviderId, KeyState> = { ...keys }
      for (const p of PROVIDERS) {
        // Keyless offline providers (Orbit engine, Local) have no secret.
        if (p.id === 'orbit' || p.id === 'local') continue
        const source = await window.orbit.secrets.source(p.id)
        next[p.id] = { value: '', source }
      }
      setKeys(next)
      const p = await getProfile()
      setProfile(p)
      setDisplayName(p?.display_name ?? '')
      setOrbit(await window.orbit.orbit.status())
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

  async function downloadOrbitModel(): Promise<void> {
    setDownloading(true)
    setPull({ status: 'starting' })
    const off = window.orbit.orbit.onPullEvent((p) => {
      // Carry the last known percent forward through Ollama's no-progress
      // terminal phases so the bar never jumps backward.
      setPull((prev) => ({ ...p, percent: p.percent ?? prev?.percent }))
      if (p.done) {
        off()
        setDownloading(false)
        void window.orbit.orbit.status().then(setOrbit)
      }
    })
    await window.orbit.orbit.download()
  }

  async function activateLicense(): Promise<void> {
    const token = licenseKey.trim()
    if (!token) return
    setLicenseBusy(true)
    setLicenseError(null)
    const res = await window.orbit.license.activate(token)
    setLicenseBusy(false)
    if (res.ok && res.status) {
      onLicenseChange(res.status)
      setLicenseKey('')
    } else {
      setLicenseError(res.error ?? 'Activation failed.')
    }
  }

  async function deactivateLicense(): Promise<void> {
    onLicenseChange(await window.orbit.license.clear())
  }

  async function toggleCloud(next: boolean): Promise<void> {
    if (next) {
      const ok = window.confirm(
        'Turn on cloud AI providers?\n\n' +
          'Chats using Claude, GPT, or Gemini — including any workspace files ' +
          'the agent reads — will be sent to that provider over the internet ' +
          'and leave your machine. The offline Orbit and Local engines are ' +
          'never affected.'
      )
      if (!ok) return
    }
    setCloudEnabled(next)
    const updated = await window.orbit.settings.set({ cloudEnabled: next })
    onSettingsChange(updated)
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

  async function removeStoredCloudKeys(): Promise<void> {
    for (const id of CLOUD_PROVIDER_IDS) {
      if (keys[id]?.source === 'user') await window.orbit.secrets.set(id, '')
    }
    const next: Record<ProviderId, KeyState> = { ...keys }
    for (const id of CLOUD_PROVIDER_IDS) {
      next[id] = { value: '', source: await window.orbit.secrets.source(id) }
    }
    setKeys(next)
  }

  const storedCloud = CLOUD_PROVIDER_IDS.filter(
    (id) => keys[id]?.source === 'user'
  )

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
            License
          </h3>
          {license?.state === 'licensed' ? (
            <div className="field">
              <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text)' }}>
                Licensed to <strong>{license.licensedTo}</strong>.
              </p>
              <button
                className="ghost-btn"
                onClick={() => void deactivateLicense()}
              >
                Deactivate on this machine
              </button>
            </div>
          ) : (
            <>
              <p style={{ marginTop: 0, fontSize: 12, color: '#6b7280' }}>
                {license?.state === 'trial'
                  ? `Trial — ${license.trialDaysLeft} day${license.trialDaysLeft === 1 ? '' : 's'} left. Verified locally; nothing is sent anywhere.`
                  : 'Unlicensed. Enter a license key to activate — verified locally, no internet needed.'}
              </p>
              <div className="field">
                <label>License key</label>
                <div className="row">
                  <input
                    type="text"
                    placeholder="Paste your license key"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                  />
                  <button
                    className="ghost-btn"
                    onClick={() => void activateLicense()}
                    disabled={licenseBusy || !licenseKey.trim()}
                  >
                    {licenseBusy ? 'Activating…' : 'Activate'}
                  </button>
                </div>
                {licenseError && <div className="auth-error">{licenseError}</div>}
              </div>
            </>
          )}

          <h3 style={{ margin: '20px 0 8px', fontSize: 13, color: '#9aa3b2' }}>
            Orbit engine
          </h3>
          {orbit ? (
            <div className="field">
              <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text)' }}>
                Orbit 1.4 adapts to your hardware — this machine has{' '}
                <strong>{orbit.ramGb} GB</strong> RAM,{' '}
                {orbit.accelerated
                  ? 'Apple Silicon (GPU-accelerated).'
                  : 'CPU-only (no GPU — larger models run slower).'}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>
                {orbit.anyPresent
                  ? `Running the ${tierLabel(orbit.resolvedTag)} model` +
                    (orbit.idealPresent
                      ? ' — the most capable this machine can run.'
                      : `. Recommended: ${orbit.idealLabel}.`)
                  : 'No offline model installed yet.'}
              </p>
              {!orbit.idealPresent &&
                (downloading ? (
                  <div>
                    <div className="orbit-progress">
                      <div
                        className="orbit-progress-bar"
                        style={{ width: `${pull?.percent ?? 3}%` }}
                      />
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                      {pull?.error
                        ? `Error: ${pull.error}`
                        : `${pull?.status ?? 'Downloading'}${
                            pull?.percent != null ? ' — ' + pull.percent + '%' : '…'
                          }`}
                    </p>
                  </div>
                ) : (
                  <button
                    className="ghost-btn"
                    onClick={() => void downloadOrbitModel()}
                  >
                    Download {orbit.idealLabel} model (~{orbit.idealSizeGb} GB)
                  </button>
                ))}
            </div>
          ) : (
            <p style={{ marginTop: 0, fontSize: 12, color: '#6b7280' }}>
              Checking your hardware…
            </p>
          )}

          <h3 style={{ margin: '20px 0 8px', fontSize: 13, color: '#9aa3b2' }}>
            Profile
          </h3>
          {profile ? (
            <>
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
            Online providers
          </h3>
          <label className="cloud-toggle">
            <input
              type="checkbox"
              checked={cloudEnabled}
              onChange={(e) => void toggleCloud(e.target.checked)}
            />
            <span>Allow cloud AI providers (Claude, GPT, Gemini)</span>
          </label>
          <p style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
            Off by default. When on, chats using these models — including any
            workspace files the agent reads — are sent to that provider's servers
            and leave your machine. The offline Orbit and Local engines are never
            affected.
          </p>

          {!cloudEnabled && storedCloud.length > 0 && (
            <div className="field">
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>
                You still have saved API keys for {storedCloud.length} cloud
                provider{storedCloud.length > 1 ? 's' : ''}. They stay encrypted
                on your machine and are never used while cloud is off.
              </p>
              <button
                className="ghost-btn"
                onClick={() => void removeStoredCloudKeys()}
              >
                Remove saved cloud keys
              </button>
            </div>
          )}

          {cloudEnabled && (
            <>
              <h3 style={{ margin: '20px 0 8px', fontSize: 13, color: '#9aa3b2' }}>
                API Keys
              </h3>
              <p style={{ marginTop: 0, fontSize: 12, color: '#6b7280' }}>
                Stored locally and encrypted with your OS keychain when
                available. Keys are sent only in requests to that provider.
              </p>
              {PROVIDERS.filter((p) => p.id !== 'orbit' && p.id !== 'local').map((p) => (
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
            </>
          )}

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
