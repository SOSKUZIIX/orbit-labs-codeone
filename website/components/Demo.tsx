export function Demo(): JSX.Element {
  return (
    <section className="relative flex justify-center px-6 pb-24">
      <div className="relative w-full max-w-6xl">
        {/* Glow under the mockup */}
        <div className="pointer-events-none absolute inset-x-10 -top-10 -bottom-10 -z-10 rounded-[40px] bg-gradient-to-b from-white/[0.06] to-transparent blur-2xl" />

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/50">
          {/* Window chrome */}
          <div className="flex h-9 items-center gap-1.5 border-b border-white/5 bg-ink-800 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <div className="ml-4 text-[11px] tracking-wide text-white/30">
              CodeOne — SOSKUZIIX/orbit-labs-codeone
            </div>
          </div>

          {/* Body grid */}
          <div className="grid grid-cols-[44px_220px_1fr_360px] text-[12px]">
            {/* Activity bar */}
            <div className="border-r border-white/5 bg-ink-900 py-3">
              {['◰', '⌕', '▷', '⚙'].map((g, i) => (
                <div
                  key={i}
                  className={`mx-auto my-3 flex h-7 w-7 items-center justify-center rounded-md text-white/40 ${
                    i === 0 ? 'bg-white/10 text-white' : 'hover:bg-white/5'
                  }`}
                >
                  {g}
                </div>
              ))}
            </div>

            {/* File tree */}
            <div className="border-r border-white/5 bg-ink-900 px-3 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/30">
                Explorer
              </div>
              <Tree />
            </div>

            {/* Editor */}
            <div className="bg-ink-950">
              <div className="flex h-8 items-center gap-3 border-b border-white/5 px-3 text-white/40">
                <div className="rounded-md bg-white/5 px-2.5 py-1 text-white">
                  Hero.tsx
                </div>
                <div>orbit-callout.tsx</div>
                <div>page.tsx</div>
              </div>
              <pre className="overflow-hidden px-4 py-3 leading-[1.7] text-white/80">
                <span className="text-white/30">  1</span>
                <span className="text-fuchsia-300">  import</span>
                <span className="text-white/70"> {'{ DownloadButtons }'} </span>
                <span className="text-fuchsia-300">from</span>
                <span className="text-emerald-300"> './DownloadButtons'</span>
                <br />
                <span className="text-white/30">  2</span>
                <br />
                <span className="text-white/30">  3</span>
                <span className="text-fuchsia-300">  export function</span>
                <span className="text-sky-300"> Hero</span>
                <span className="text-white/70">(): </span>
                <span className="text-sky-300">JSX.Element</span>
                <span className="text-white/70"> {'{'}</span>
                <br />
                <span className="text-white/30">  4</span>
                <span className="text-white/70">    {'return ('}</span>
                <br />
                <span className="text-white/30">  5</span>
                <span className="text-rose-300">      &lt;section</span>
                <span className="text-amber-200"> className</span>
                <span className="text-white/70">=</span>
                <span className="text-emerald-300">"hero"</span>
                <span className="text-rose-300">&gt;</span>
                <br />
                <span className="text-white/30">  6</span>
                <span className="text-white/70">        </span>
                <span className="text-rose-300">&lt;h1&gt;</span>
                <span className="text-white">Welcome.</span>
                <span className="text-rose-300">&lt;/h1&gt;</span>
                <br />
                <span className="text-white/30">  7</span>
                <span className="text-rose-300">      &lt;/section&gt;</span>
                <br />
                <span className="text-white/30">  8</span>
                <span className="text-white/70">    {')'}</span>
                <br />
                <span className="text-white/30">  9</span>
                <span className="text-white/70">  {'}'}</span>
                <span className="ml-1 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-white" />
              </pre>
            </div>

            {/* Agent panel */}
            <div className="border-l border-white/5 bg-ink-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/30">
                  Agent
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                  Orbit 1.2
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-white/70">
                  Refactor Hero so the headline auto-balances and the CTA group
                  stacks on mobile.
                </div>
                <div className="rounded-lg bg-white/[0.05] p-2.5 text-[11px] text-white/90">
                  Updated <span className="text-emerald-300">Hero.tsx</span> —
                  added text-balance and a flex column at the sm breakpoint.
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-white/40">
                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-emerald-300">
                      modified
                    </span>
                    components/Hero.tsx
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-white/10 bg-ink-800 p-2.5 text-[11px] text-white/40">
                Ask anything…
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex h-7 items-center gap-3 border-t border-white/5 bg-ink-800 px-4 text-[10px] text-white/40">
            <span>main</span>
            <span>·</span>
            <span>TypeScript React</span>
            <span className="ml-auto">orbit · Orbit 1.2</span>
            <span>you@orbitlabs.dev</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Tree(): JSX.Element {
  const items: { label: string; depth: number; muted?: boolean; active?: boolean }[] = [
    { label: 'app/', depth: 0 },
    { label: 'layout.tsx', depth: 1 },
    { label: 'page.tsx', depth: 1 },
    { label: 'components/', depth: 0 },
    { label: 'Hero.tsx', depth: 1, active: true },
    { label: 'Demo.tsx', depth: 1 },
    { label: 'Features.tsx', depth: 1 },
    { label: 'Footer.tsx', depth: 1 },
    { label: 'public/', depth: 0 },
    { label: 'logo.png', depth: 1, muted: true }
  ]
  return (
    <div className="space-y-0.5">
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex items-center rounded px-2 py-0.5 ${
            it.active
              ? 'bg-white/10 text-white'
              : it.muted
                ? 'text-white/30'
                : 'text-white/60'
          }`}
          style={{ paddingLeft: 8 + it.depth * 12 }}
        >
          <span className="mr-1.5 text-white/30">
            {it.label.endsWith('/') ? '▾' : '·'}
          </span>
          {it.label}
        </div>
      ))}
    </div>
  )
}
