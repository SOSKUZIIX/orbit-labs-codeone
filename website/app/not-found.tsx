import Link from 'next/link'

export default function NotFound(): JSX.Element {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
        Build coming soon
      </div>
      <h1 className="mt-4 max-w-xl text-balance text-4xl font-medium tracking-tight text-gradient sm:text-5xl">
        We're packaging this build.
      </h1>
      <p className="mt-5 max-w-md text-balance text-white/55">
        That download isn't published yet. Check back shortly, or grab a
        different platform.
      </p>
      <Link
        href="/#download"
        className="mt-8 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition hover:bg-white/90"
      >
        Back to downloads
      </Link>
    </main>
  )
}
