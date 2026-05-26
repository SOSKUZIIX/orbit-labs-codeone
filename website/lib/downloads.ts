export type DownloadTarget = 'mac' | 'macIntel' | 'win'

const DOWNLOAD_BASE_URL = process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL?.replace(/\/$/, '') ?? ''

export const DOWNLOADS: Record<
  DownloadTarget,
  { label: string; shortLabel: string; fileName: string; href: string }
> = {
  mac: {
    label: 'Download for macOS',
    shortLabel: 'macOS',
    fileName: 'CodeOne-mac.dmg',
    href: buildDownloadUrl('CodeOne-mac.dmg')
  },
  macIntel: {
    label: 'Download for macOS (Intel)',
    shortLabel: 'macOS (Intel)',
    fileName: 'CodeOne-mac-intel.dmg',
    href: buildDownloadUrl('CodeOne-mac-intel.dmg')
  },
  win: {
    label: 'Download for Windows',
    shortLabel: 'Windows',
    fileName: 'CodeOne-win.exe',
    href: buildDownloadUrl('CodeOne-win.exe')
  }
}

export function isLocalDownload(href: string): boolean {
  return href.startsWith('/')
}

function buildDownloadUrl(fileName: string): string {
  if (!DOWNLOAD_BASE_URL) return `/downloads/${fileName}`
  return `${DOWNLOAD_BASE_URL}/${fileName}`
}
