import { promises as fs } from 'node:fs'
import { join, resolve, sep, relative } from 'node:path'
import type { SearchHit } from '@shared/types'

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

const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg',
  'mp4', 'mov', 'webm', 'mp3', 'wav', 'ogg',
  'pdf', 'zip', 'gz', 'tar', 'rar', '7z',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'dmg', 'so', 'dylib', 'dll'
])

const MAX_FILE_BYTES = 1_000_000
const MAX_HITS = 500

function isBinaryByExt(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return BINARY_EXTS.has(ext)
}

function withinRoot(root: string, p: string): boolean {
  const r = resolve(root)
  const target = resolve(p)
  const rel = relative(r, target)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`..${sep}`))
}

export async function searchFiles(
  root: string,
  query: string,
  caseSensitive = false
): Promise<SearchHit[]> {
  if (!query || !root) return []
  const needle = caseSensitive ? query : query.toLowerCase()
  const hits: SearchHit[] = []

  async function walk(dir: string): Promise<void> {
    if (hits.length >= MAX_HITS) return
    if (!withinRoot(root, dir)) return
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (hits.length >= MAX_HITS) return
      if (IGNORE.has(entry)) continue
      const full = join(dir, entry)
      let stat
      try {
        stat = await fs.stat(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        await walk(full)
      } else if (stat.isFile()) {
        if (stat.size > MAX_FILE_BYTES) continue
        if (isBinaryByExt(entry)) continue
        let text: string
        try {
          text = await fs.readFile(full, 'utf8')
        } catch {
          continue
        }
        const lines = text.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const haystack = caseSensitive ? line : line.toLowerCase()
          const idx = haystack.indexOf(needle)
          if (idx >= 0) {
            hits.push({
              path: full,
              line: i + 1,
              col: idx + 1,
              preview: line.length > 200 ? line.slice(0, 200) + '…' : line
            })
            if (hits.length >= MAX_HITS) return
          }
        }
      }
    }
  }

  await walk(root)
  return hits
}
