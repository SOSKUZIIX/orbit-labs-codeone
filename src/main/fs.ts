import { dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { join, resolve, basename, sep, relative } from 'node:path'
import type {
  FileNode,
  OpenFolderResult,
  FileReadResult,
  ImportedAttachment
} from '@shared/types'
import { getSettings, setSettings } from './store'
import { recordSnapshot } from './snapshots'

const IGNORE = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'out',
  'build',
  '.cache',
  '.DS_Store',
  '.idea',
  '.vscode-test'
])

const MAX_ENTRIES_PER_DIR = 2000
const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB
const MAX_IMAGE_BYTES = 12 * 1024 * 1024 // 12 MB

const IMAGE_EXTS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  avif: 'image/avif'
}

const MIME_EXTS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/svg+xml': 'svg',
  'image/avif': 'avif'
}

function imageMimeFor(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS[ext] ?? null
}

function withinRoot(root: string, p: string): boolean {
  const r = resolve(root)
  const target = resolve(p)
  const rel = relative(r, target)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`..${sep}`))
}

export async function readDirNode(
  path: string,
  depth: number,
  maxDepth: number
): Promise<FileNode> {
  const name = basename(path) || path
  let stat
  try {
    stat = await fs.stat(path)
  } catch {
    return { name, path, isDirectory: false }
  }
  if (!stat.isDirectory()) {
    return { name, path, isDirectory: false }
  }
  if (depth >= maxDepth) {
    return { name, path, isDirectory: true, children: undefined }
  }
  let entries: string[] = []
  try {
    entries = await fs.readdir(path)
  } catch {
    return { name, path, isDirectory: true, children: [] }
  }
  entries = entries
    .filter((e) => !IGNORE.has(e))
    .slice(0, MAX_ENTRIES_PER_DIR)
    .sort((a, b) => a.localeCompare(b))

  const children: FileNode[] = []
  for (const entry of entries) {
    const full = join(path, entry)
    try {
      const s = await fs.stat(full)
      if (s.isDirectory()) {
        children.push({
          name: entry,
          path: full,
          isDirectory: true,
          children: undefined
        })
      } else if (s.isFile()) {
        children.push({ name: entry, path: full, isDirectory: false })
      }
    } catch {
      /* skip */
    }
  }
  // dirs first, then files
  children.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { name, path, isDirectory: true, children }
}

export async function openFolderDialog(
  window: BrowserWindow | null
): Promise<OpenFolderResult | null> {
  const result = window
    ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  const root = result.filePaths[0]
  const tree = await readDirNode(root, 0, 1)
  await recordRecentFolder(root)
  return { root, tree }
}

export async function readDirShallow(path: string): Promise<FileNode> {
  return readDirNode(path, 0, 1)
}

export async function readFile(
  root: string,
  path: string
): Promise<FileReadResult> {
  if (!withinRoot(root, path)) {
    throw new Error('Access denied: path outside workspace root')
  }
  const stat = await fs.stat(path)
  const imageMime = imageMimeFor(path)
  if (imageMime) {
    if (stat.size > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large (${stat.size} bytes)`)
    }
    const buf = await fs.readFile(path)
    if (imageMime === 'image/svg+xml') {
      return {
        path,
        content: buf.toString('utf8'),
        encoding: 'image',
        mimeType: imageMime
      }
    }
    const dataUrl = `data:${imageMime};base64,${buf.toString('base64')}`
    return { path, content: dataUrl, encoding: 'image', mimeType: imageMime }
  }
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(`File too large (${stat.size} bytes)`)
  }
  const buf = await fs.readFile(path)
  const probe = buf.subarray(0, Math.min(buf.length, 8192))
  for (let i = 0; i < probe.length; i++) {
    if (probe[i] === 0) {
      return { path, content: '', encoding: 'binary' }
    }
  }
  const text = buf.toString('utf8')
  // Take an "open" snapshot so users can always roll back to the original.
  recordSnapshot(path, text, 'open')
  return { path, content: text, encoding: 'utf8' }
}

export async function writeFile(
  root: string,
  path: string,
  content: string
): Promise<void> {
  if (!withinRoot(root, path)) {
    throw new Error('Access denied: path outside workspace root')
  }
  // Snapshot the existing file content before overwriting it.
  try {
    const existing = await fs.readFile(path, 'utf8')
    recordSnapshot(path, existing, 'pre-save')
  } catch {
    /* file may not exist — first save */
  }
  await fs.writeFile(path, content, 'utf8')
}

export async function importAttachment(
  root: string,
  fileName: string,
  dataUrl: string
): Promise<ImportedAttachment> {
  if (!root) throw new Error('Open a workspace before attaching images')
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('Only base64 image attachments are supported')
  const mimeType = match[1]
  const ext = MIME_EXTS[mimeType]
  if (!ext) throw new Error(`Unsupported image type: ${mimeType}`)
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large (${buffer.length} bytes)`)
  }
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'image'
  const dir = join(root, 'assets', 'codeone-attachments')
  const name = `${Date.now()}-${safeBase}.${ext}`
  const path = join(dir, name)
  if (!withinRoot(root, path)) {
    throw new Error('Access denied: attachment path outside workspace root')
  }
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path, buffer)
  return { name, path, mimeType }
}

export async function recordRecentFolder(path: string): Promise<void> {
  const s = await getSettings()
  const list = (s.recentFolders ?? []).filter((p) => p !== path)
  list.unshift(path)
  await setSettings({ recentFolders: list.slice(0, 10) })
}

export async function recentFolders(): Promise<string[]> {
  const s = await getSettings()
  return s.recentFolders ?? []
}
