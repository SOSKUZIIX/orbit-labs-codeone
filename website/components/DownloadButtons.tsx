'use client'

import { useEffect, useState } from 'react'
import { DOWNLOADS, isLocalDownload, type DownloadTarget } from '@/lib/downloads'

type OS = DownloadTarget | 'unknown'

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'win'
  return 'unknown'
}

type Availability = Record<DownloadTarget, boolean | null>

export function DownloadButtons(): JSX.Element {
  const [os, setOS] = useState<OS>('unknown')
  const [avail, setAvail] = useState<Availability>({
    mac: null,
    macIntel: null,
    win: null
  })

  useEffect(() => {
    setOS(detectOS())
    ;(['mac', 'macIntel', 'win'] as const).forEach((o) => {
      // Cross-origin hosts (e.g. github.com release downloads) don't allow
      // HEAD with CORS — just assume reachable. Only HEAD same-origin paths.
      const url = DOWNLOADS[o].href
      const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin)
      if (!sameOrigin) {
        setAvail((a) => ({ ...a, [o]: true }))
        return
      }
      fetch(url, { method: 'HEAD' })
        .then((r) => setAvail((a) => ({ ...a, [o]: r.ok })))
        .catch(() => setAvail((a) => ({ ...a, [o]: false })))
    })
  }, [])

  const primary: DownloadTarget = os === 'unknown' ? 'mac' : os
  const others = (['mac', 'macIntel', 'win'] as const).filter((o) => o !== primary)

  const primaryAvail = avail[primary]
  const primaryDownload = DOWNLOADS[primary]

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      {primaryAvail === false ? (
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/50"
        >
          <ClockIcon />
          {primaryDownload.shortLabel} build coming soon
        </button>
      ) : (
        <a
          href={primaryDownload.href}
          download={isLocalDownload(primaryDownload.href) ? primaryDownload.fileName : undefined}
          className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black shadow-glow transition hover:scale-[1.02] hover:bg-white"
        >
          <DownloadIcon />
          {primaryDownload.label}
        </a>
      )}
      <div className="flex gap-2">
        {others.map((o) => {
          const ok = avail[o]
          const download = DOWNLOADS[o]
          return (
            <a
              key={o}
              href={ok === false ? undefined : download.href}
              download={ok !== false && isLocalDownload(download.href) ? download.fileName : undefined}
              aria-disabled={ok === false || undefined}
              onClick={(e) => {
                if (ok === false) e.preventDefault()
              }}
              className={
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[13px] transition ' +
                (ok === false
                  ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/30'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white')
              }
            >
              {download.shortLabel}
              {ok === false && <span className="text-[10px]">· soon</span>}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function DownloadIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition group-hover:translate-y-0.5"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function ClockIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}
