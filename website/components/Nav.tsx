import Link from 'next/link'

export function Nav(): JSX.Element {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav className="flex w-full max-w-5xl items-center justify-between rounded-full border border-white/8 bg-ink-900/60 px-5 py-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="CodeOne"
            className="h-9 w-auto invert sm:h-10"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <span className="text-base font-medium tracking-tight">CodeOne</span>
        </Link>
        <div className="hidden items-center gap-7 text-[13px] text-white/60 sm:flex">
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#orbit" className="transition hover:text-white">
            Orbit 1.2
          </a>
          <Link href="/releases" className="transition hover:text-white">
            Releases
          </Link>
        </div>
        <a
          href="#download"
          className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition hover:bg-white/90"
        >
          Download
        </a>
      </nav>
    </header>
  )
}
