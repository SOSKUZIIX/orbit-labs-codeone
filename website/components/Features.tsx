interface Feature {
  title: string
  body: string
  icon: JSX.Element
}

const FEATURES: Feature[] = [
  {
    title: 'Bring your own AI',
    body: 'Plug in Anthropic, OpenAI, or Google keys. Switch providers in one click — your keys stay on your machine, encrypted at rest.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="11" width="18" height="9" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  },
  {
    title: 'Real agent, not autocomplete',
    body: 'CodeOne reads your repo, plans, edits files, runs commands, and checks its own work. Plan mode pauses before touching code.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    )
  },
  {
    title: 'Integrated terminal',
    body: 'A real shell, scoped to your workspace. Open it with ⌘`, run anything — tests, dev servers, git — without leaving the editor.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9l3 3-3 3M13 15h5" />
      </svg>
    )
  },
  {
    title: 'Live preview',
    body: 'Edit HTML, React, or any web project and see it render inside the editor. Point at a localhost URL or open the file directly.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
      </svg>
    )
  },
  {
    title: 'Cloud-synced history',
    body: 'Conversations, recents, and settings sync across machines via Supabase. Sign in and pick up where you left off, anywhere.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M17 19a4 4 0 0 0 .9-7.9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6 19h11Z" />
      </svg>
    )
  },
  {
    title: 'Native, fast, dark by default',
    body: 'Built on Electron with care: real OS chrome, Monaco editor, zero telemetry on by default. Your editor, your rules.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </svg>
    )
  }
]

export function Features(): JSX.Element {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-6xl px-6 pb-32 pt-16"
    >
      <div className="mx-auto mb-20 max-w-2xl text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
          Built for shipping
        </div>
        <h2 className="mt-4 text-balance text-3xl font-medium tracking-tight text-gradient sm:text-5xl">
          Everything you need.
          <br />
          Nothing you don't.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] p-7 transition duration-300 hover:border-white/[0.14] hover:bg-white/[0.035]"
          >
            <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition group-hover:opacity-100" />
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-white/85 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {f.icon}
            </div>
            <h3 className="text-[15px] font-medium tracking-tight text-white">
              {f.title}
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-[1.65] text-white/55">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
