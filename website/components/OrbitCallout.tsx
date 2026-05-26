export function OrbitCallout(): JSX.Element {
  return (
    <section id="orbit" className="relative px-6 pb-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.015] p-10 sm:p-16">
        {/* Decorative orbits */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/[0.08]" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.04] blur-2xl" />

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Orbit 1.2 · included
          </div>
          <h2 className="mt-6 text-balance text-3xl font-medium tracking-tight text-gradient sm:text-5xl">
            Our model. On the house.
          </h2>
          <p className="mt-5 max-w-xl text-balance text-white/55 sm:text-[17px] sm:leading-relaxed">
            Sign in and Orbit 1.2 just works — no API key, no credit card.
            Every account gets 25 messages per 6-hour window so you can try
            the full agent without setup.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {[
              'No API key required',
              'Server-side rate limits',
              'Same agent, same speed'
            ].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/70"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-3">
            <a
              href="#download"
              className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition hover:bg-white/90"
            >
              Get CodeOne
            </a>
            <a
              href="#features"
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/80 transition hover:border-white/20 hover:text-white"
            >
              Explore features
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
