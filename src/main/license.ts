import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import { join } from 'node:path'
import type { LicenseActivateResult, LicenseStatus } from '@shared/types'

/**
 * Offline license verification.
 *
 * Licenses are Ed25519-signed by Orbit Labs' private key and verified here
 * against the embedded public key. Verification is fully local — no network,
 * ever. Forging a valid key is infeasible without the private key.
 *
 * Honest limits (documented in the threat model): offline verification deters
 * FORGERY, it does not stop a determined attacker from patching the binary to
 * skip the check, and the trial clock is local so wiping app data resets it.
 * This is licensing (deterrence), not DRM.
 */
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAAsS8+nF48r/iyddE9LZLE82QO23UPiWHV9CoM+8MU6A=
-----END PUBLIC KEY-----
`

const TRIAL_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

interface LicensePayload {
  v: number
  licensedTo: string
  issuedAt: number
}

interface LicenseFile {
  token?: string
  firstRunAt?: number
}

function licensePath(): string {
  return join(app.getPath('userData'), 'license.json')
}

async function readLicenseFile(): Promise<LicenseFile> {
  try {
    return JSON.parse(await fs.readFile(licensePath(), 'utf8')) as LicenseFile
  } catch {
    return {}
  }
}

async function writeLicenseFile(data: LicenseFile): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(licensePath(), JSON.stringify(data, null, 2))
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/**
 * Verify a license token offline. Token format: base64url(payloadJSON) + "." +
 * base64url(ed25519Signature). Returns the payload iff the signature is valid.
 */
export function verifyLicenseToken(token: string): LicensePayload | null {
  try {
    const trimmed = token.trim()
    const dot = trimmed.indexOf('.')
    if (dot < 0) return null
    const payloadBytes = b64urlDecode(trimmed.slice(0, dot))
    const sig = b64urlDecode(trimmed.slice(dot + 1))
    const key = createPublicKey(LICENSE_PUBLIC_KEY_PEM)
    if (!cryptoVerify(null, payloadBytes, key, sig)) return null
    const payload = JSON.parse(payloadBytes.toString('utf8')) as LicensePayload
    if (!payload || typeof payload.licensedTo !== 'string') return null
    return payload
  } catch {
    return null
  }
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const file = await readLicenseFile()

  // Start the trial clock on first run.
  let firstRunAt = file.firstRunAt
  if (!firstRunAt) {
    firstRunAt = Date.now()
    await writeLicenseFile({ ...file, firstRunAt })
  }

  // A valid stored license always wins.
  if (file.token) {
    const payload = verifyLicenseToken(file.token)
    if (payload) {
      return {
        state: 'licensed',
        licensedTo: payload.licensedTo,
        issuedAt: payload.issuedAt
      }
    }
  }

  // Otherwise fall back to the local trial window.
  const elapsed = Date.now() - firstRunAt
  const daysLeft = Math.max(
    0,
    Math.ceil((TRIAL_DAYS * DAY_MS - elapsed) / DAY_MS)
  )
  return daysLeft > 0 ? { state: 'trial', trialDaysLeft: daysLeft } : { state: 'expired' }
}

export async function activateLicense(token: string): Promise<LicenseActivateResult> {
  const payload = verifyLicenseToken(token)
  if (!payload) {
    return {
      ok: false,
      error: 'Invalid license key. Paste the full key exactly as issued.'
    }
  }
  const file = await readLicenseFile()
  await writeLicenseFile({ ...file, token: token.trim() })
  return {
    ok: true,
    status: {
      state: 'licensed',
      licensedTo: payload.licensedTo,
      issuedAt: payload.issuedAt
    }
  }
}

export async function clearLicense(): Promise<LicenseStatus> {
  const file = await readLicenseFile()
  delete file.token
  await writeLicenseFile(file)
  return getLicenseStatus()
}
