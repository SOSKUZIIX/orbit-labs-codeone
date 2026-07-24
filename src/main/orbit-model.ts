import os from 'node:os'
import { safeFetch } from './net-guard'
import { localEndpoint } from './providers/local-runtime'
import type { OrbitStatus, OrbitPullProgress } from '@shared/types'

/**
 * "Orbit 1.4" is a brand, not a fixed model. Under the hood it runs the largest
 * Qwen2.5-Coder tier the machine's RAM can hold — from 1.5B on a light laptop to
 * 32B on a workstation. Selection is by total RAM (the binding constraint for
 * whether a model fits); Apple Silicon runs each tier considerably faster than
 * an Intel machine with the same RAM.
 *
 * Downloads go through the LOCAL runtime (Ollama) over loopback: the app tells
 * Ollama to pull, and Ollama fetches from its registry. The app itself never
 * makes a non-loopback request, so the air-gap posture is preserved (a
 * fully-offline deployment simply pre-loads the model instead).
 */
export interface OrbitTier {
  tag: string
  label: string
  sizeGb: number
  /** Min RAM (GB) on an accelerated runtime — Apple Silicon (unified memory +
   *  Metal), where each tier runs fast and memory-efficiently. */
  minRamAccel: number
  /** Min RAM (GB) on a CPU-only runtime (Intel/AMD without a GPU) — needs more
   *  headroom and runs each tier much slower, so we stay conservative. */
  minRamCpu: number
}

// Largest → smallest. Thresholds bake in headroom for the OS + the app.
const TIERS: OrbitTier[] = [
  { tag: 'qwen2.5-coder:32b', label: '32B', sizeGb: 20, minRamAccel: 32, minRamCpu: 48 },
  { tag: 'qwen2.5-coder:14b', label: '14B', sizeGb: 9, minRamAccel: 20, minRamCpu: 28 },
  { tag: 'qwen2.5-coder:7b', label: '7B', sizeGb: 4.7, minRamAccel: 12, minRamCpu: 18 },
  { tag: 'qwen2.5-coder:3b', label: '3B', sizeGb: 1.9, minRamAccel: 8, minRamCpu: 8 },
  { tag: 'qwen2.5-coder:1.5b', label: '1.5B', sizeGb: 1.0, minRamAccel: 0, minRamCpu: 0 }
]

export function systemRamGb(): number {
  return os.totalmem() / 1024 ** 3
}

/**
 * Apple Silicon runs Ollama on the Metal GPU with unified memory — dramatically
 * faster and more memory-efficient than a CPU-only Intel machine, so it can run
 * a larger tier at the same RAM. (Non-Mac machines with discrete GPUs also
 * accelerate, but aren't reliably detectable here, so they're treated as CPU —
 * conservative but safe.)
 */
export function isAccelerated(): boolean {
  return process.platform === 'darwin' && process.arch === 'arm64'
}

function minRamFor(t: OrbitTier, accel: boolean): number {
  return accel ? t.minRamAccel : t.minRamCpu
}

/** The best tier this machine can run, given its RAM and accelerator. */
export function selectOrbitTier(
  ramGb = systemRamGb(),
  accel = isAccelerated()
): OrbitTier {
  return TIERS.find((t) => ramGb >= minRamFor(t, accel)) ?? TIERS[TIERS.length - 1]
}

function ollamaBase(): string {
  try {
    return new URL(localEndpoint()).origin
  } catch {
    return 'http://127.0.0.1:11434'
  }
}

/** Is the local runtime (Ollama) up and reachable on loopback? */
export async function isRuntimeReachable(): Promise<boolean> {
  try {
    const res = await safeFetch(`${ollamaBase()}/api/version`)
    return res.ok
  } catch {
    return false
  }
}

async function listPresentTags(): Promise<Set<string>> {
  try {
    const res = await safeFetch(`${ollamaBase()}/api/tags`)
    if (!res.ok) return new Set()
    const json = (await res.json()) as { models?: { name: string }[] }
    return new Set((json.models ?? []).map((m) => m.name))
  } catch {
    return new Set()
  }
}

// Short cache so we don't hit /api/tags on every chat request.
let cachedTag: string | null = null
let cachedAt = 0
const CACHE_MS = 15_000

export function invalidateOrbitModelCache(): void {
  cachedTag = null
  cachedAt = 0
}

/**
 * Resolve a requested model to a real Ollama tag. The "Orbit 1.4" brand maps to
 * the largest downloaded tier the machine can run; explicit tags pass through.
 */
export async function resolveOrbitModelTag(requested: string): Promise<string> {
  if (requested !== 'Orbit 1.4') return requested
  const now = Date.now()
  if (cachedTag && now - cachedAt < CACHE_MS) return cachedTag
  const present = await listPresentTags()
  const ram = systemRamGb()
  const accel = isAccelerated()
  const runnable = TIERS.filter((t) => ram >= minRamFor(t, accel))
  const best = runnable.find((t) => present.has(t.tag))
  const tag = best?.tag ?? selectOrbitTier(ram, accel).tag
  cachedTag = tag
  cachedAt = now
  return tag
}

export async function orbitStatus(): Promise<OrbitStatus> {
  const ram = systemRamGb()
  const accel = isAccelerated()
  const ideal = selectOrbitTier(ram, accel)
  const [present, runtimeReachable] = await Promise.all([
    listPresentTags(),
    isRuntimeReachable()
  ])
  const runnable = TIERS.filter((t) => ram >= minRamFor(t, accel))
  const resolvedTag = runnable.find((t) => present.has(t.tag))?.tag ?? ideal.tag
  return {
    ramGb: Math.round(ram),
    accelerated: accel,
    runtimeReachable,
    idealTag: ideal.tag,
    idealLabel: ideal.label,
    idealSizeGb: ideal.sizeGb,
    resolvedTag,
    idealPresent: present.has(ideal.tag),
    anyPresent: runnable.some((t) => present.has(t.tag))
  }
}

/**
 * Ask the local runtime to download a model, streaming progress. Only the ideal
 * tier for this machine may be requested.
 */
export async function pullOrbitModel(
  onProgress: (p: OrbitPullProgress) => void
): Promise<void> {
  const tag = selectOrbitTier().tag
  try {
    const res = await safeFetch(`${ollamaBase()}/api/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: tag, stream: true })
    })
    if (!res.ok || !res.body) {
      onProgress({ status: '', done: true, error: `Download failed (${res.status}). Is the local runtime (Ollama) running?` })
      return
    }
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        try {
          const j = JSON.parse(line) as {
            status?: string
            total?: number
            completed?: number
            error?: string
          }
          if (j.error) {
            onProgress({ status: '', done: true, error: j.error })
            return
          }
          // completed can be 0 (valid 0%); only phases without a total (manifest
          // verify, writing manifest) have no percent.
          const percent = j.total
            ? Math.round(((j.completed ?? 0) / j.total) * 100)
            : undefined
          onProgress({ status: j.status ?? '', percent })
        } catch {
          /* ignore partial line */
        }
      }
    }
    invalidateOrbitModelCache()
    onProgress({ status: 'success', percent: 100, done: true })
  } catch (err) {
    onProgress({
      status: '',
      done: true,
      error: err instanceof Error ? err.message : String(err)
    })
  }
}
