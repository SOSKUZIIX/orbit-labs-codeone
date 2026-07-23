import { useEffect, useState } from 'react'
import type { LicenseStatus } from '@shared/types'
import App from './App'
import { Activation } from './components/Activation'

// Fully offline: no login gate. Access is gated only by a locally-verified
// license — a 14-day trial on first run, then a valid key. All checks are local
// (Ed25519 signature verification); nothing is ever sent to a server.
export default function Root(): JSX.Element {
  const [license, setLicense] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    void window.orbit.license.get().then(setLicense)
  }, [])

  if (!license) return <div className="welcome" />
  if (license.state === 'expired') {
    return <Activation onActivated={setLicense} />
  }
  return <App license={license} onLicenseChange={setLicense} />
}
