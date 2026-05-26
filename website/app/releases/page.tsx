import type { Metadata } from 'next'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { DOWNLOADS, isLocalDownload } from '@/lib/downloads'

export const metadata: Metadata = {
  title: 'Releases — CodeOne',
  description: 'Every CodeOne release, with what changed and direct downloads.'
}

interface Release {
  version: string
  date: string
  tag?: 'latest' | 'beta'
  highlights: string[]
  downloads: { label: string; href: string; fileName: string }[]
}

// Append new releases at the top. The top entry should match website/public/latest.json.
const RELEASES: Release[] = [
  {
    version: '0.1.0-beta.0',
    date: '2026-05-26',
    tag: 'latest',
    highlights: [
      'Initial public beta',
      'Orbit 1.2 — our in-house model, included free for signed-in users',
      'Onboarding tour and persona survey',
      'Cloud sync via Supabase for chat history, recents, and settings'
    ],
    downloads: [
      {
        label: 'macOS (Apple Silicon)',
        href: DOWNLOADS.mac.href,
        fileName: DOWNLOADS.mac.fileName
      },
      {
        label: 'macOS (Intel)',
        href: DOWNLOADS.macIntel.href,
        fileName: DOWNLOADS.macIntel.fileName
      },
      {
        label: 'Windows',
        href: DOWNLOADS.win.href,
        fileName: DOWNLOADS.win.fileName
      }
    ]
  }
]

export default function ReleasesPage(): JSX.Element {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Nav />

      <section className="relative px-6 pb-12 pt-40 sm:pt-48">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            Changelog
          </div>
          <h1 className="mt-4 text-balance text-4xl font-medium tracking-tight text-gradient sm:text-6xl">
            Releases
          </h1>
          <p className="mt-5 text-balance text-white/55">
            Every CodeOne build, what's new, and where to get it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-32">
        <ol className="space-y-10">
          {RELEASES.map((r) => (
            <li
              key={r.version}
              className="relative rounded-2xl border border-white/[0.07] bg-white/[0.015] p-8 transition hover:border-white/[0.14]"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl font-medium tracking-tight text-white">
                  v{r.version}
                </h2>
                {r.tag === 'latest' && (
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                    Latest
                  </span>
                )}
                {r.tag === 'beta' && (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
                    Beta
                  </span>
                )}
                <span className="ml-auto text-[12px] text-white/40">
                  {new Date(r.date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <ul className="mt-6 space-y-2.5 text-[14px] text-white/70">
                {r.highlights.map((h) => (
                  <li key={h} className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-2">
                {r.downloads.map((d) => (
                  <a
                    key={d.href}
                    href={d.href}
                    download={isLocalDownload(d.href) ? d.fileName : undefined}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12.5px] text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    <DownloadIcon />
                    {d.label}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Footer />
    </main>
  )
}

function DownloadIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
