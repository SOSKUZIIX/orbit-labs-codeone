import { promises as fs } from 'node:fs'
import type { FileSnapshot } from '@shared/types'

const MAX_PER_FILE = 20
const store = new Map<string, FileSnapshot[]>()

function nowLabel(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function recordSnapshot(
  path: string,
  content: string,
  reason: 'open' | 'pre-save' | 'manual' = 'manual'
): FileSnapshot {
  const list = store.get(path) ?? []
  // Skip duplicate consecutive snapshots.
  const last = list[list.length - 1]
  if (last && last.content === content) return last
  const snap: FileSnapshot = {
    path,
    content,
    createdAt: Date.now(),
    label: `${nowLabel()} (${reason})`
  }
  list.push(snap)
  if (list.length > MAX_PER_FILE) list.shift()
  store.set(path, list)
  return snap
}

export function listSnapshots(path: string): FileSnapshot[] {
  return [...(store.get(path) ?? [])].reverse()
}

export async function restoreSnapshot(
  path: string,
  createdAt: number
): Promise<FileSnapshot | null> {
  const list = store.get(path) ?? []
  const snap = list.find((s) => s.createdAt === createdAt)
  if (!snap) return null
  // Snapshot the current on-disk content first so the restore is itself reversible.
  try {
    const current = await fs.readFile(path, 'utf8')
    recordSnapshot(path, current, 'pre-save')
  } catch {
    /* file may not exist yet */
  }
  await fs.writeFile(path, snap.content, 'utf8')
  return snap
}
