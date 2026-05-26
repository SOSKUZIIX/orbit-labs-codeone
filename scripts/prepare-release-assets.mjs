import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const distDir = join(root, 'dist')
const outDir = join(root, 'release-binaries')

const targetFor = [
  {
    name: 'CodeOne-mac.dmg',
    match: (file) => file.endsWith('-arm64.dmg')
  },
  {
    name: 'CodeOne-mac-intel.dmg',
    match: (file) => file.endsWith('.dmg') && !file.endsWith('-arm64.dmg')
  },
  {
    name: 'CodeOne-win.exe',
    match: (file) => file.endsWith('.exe')
  }
]

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const files = await readdir(distDir)
const copied = []

for (const target of targetFor) {
  const source = files.find(target.match)
  if (!source) continue
  await copyFile(join(distDir, source), join(outDir, target.name))
  const info = await stat(join(outDir, target.name))
  copied.push({ file: target.name, bytes: info.size, source })
}

if (!copied.length) {
  throw new Error('No release binaries were found in dist/. Build the app before preparing release assets.')
}

console.table(copied)
