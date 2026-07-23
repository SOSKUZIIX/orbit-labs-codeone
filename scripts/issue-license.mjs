#!/usr/bin/env node
// Mint an offline CodeOne license key (Ed25519-signed, authenticity-only).
//
//   node scripts/issue-license.mjs --name "Acme Corp"
//
// The private signing key is read from $ORBIT_LICENSE_PRIVATE_KEY_FILE, or
// ./.license-signing-key.pem by default. NEVER commit that file. The matching
// public key is embedded in src/main/license.ts and verifies keys offline.
//
// Output: a single license token string. Give it to the customer; they paste it
// into CodeOne (Settings → License, or the activation screen).

import { readFileSync } from 'node:fs'
import { createPrivateKey, sign as cryptoSign } from 'node:crypto'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const licensedTo = arg('name')
if (!licensedTo) {
  console.error('Usage: node scripts/issue-license.mjs --name "Licensed To"')
  process.exit(1)
}

const keyFile =
  process.env.ORBIT_LICENSE_PRIVATE_KEY_FILE || '.license-signing-key.pem'

let privateKey
try {
  privateKey = createPrivateKey(readFileSync(keyFile, 'utf8'))
} catch (err) {
  console.error(`Could not read signing key at ${keyFile}: ${err.message}`)
  console.error('Set ORBIT_LICENSE_PRIVATE_KEY_FILE or place .license-signing-key.pem here.')
  process.exit(1)
}

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const payload = { v: 1, licensedTo, issuedAt: Date.now() }
const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8')
const sig = cryptoSign(null, payloadBytes, privateKey)
const token = `${b64url(payloadBytes)}.${b64url(sig)}`

console.log(token)
