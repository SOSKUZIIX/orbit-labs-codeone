import { DownloadButtons } from './DownloadButtons'

export function Hero(): JSX.Element {
  return (
    <section
      id="download"
      className="relative flex flex-col items-center justify-center px-6 pb-28 pt-44 text-center sm:pb-32 sm:pt-56"
    >
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />

      <h1 className="fade-up max-w-4xl text-balance text-5xl font-medium leading-[1.02] tracking-tight text-gradient sm:text-7xl">
        The AI coding workspace,
        <br className="hidden sm:block" /> built for you.
      </h1>

      <p
        className="fade-up mt-7 max-w-xl text-balance text-base text-white/55 sm:text-lg"
        style={{ animationDelay: '0.08s' }}
      >
        A multi-provider agent, a real terminal, and a live preview in one
        editor. Bring your own keys — or use Orbit 1.2, our model, free.
      </p>

      <div
        className="fade-up mt-12"
        style={{ animationDelay: '0.16s' }}
      >
        <DownloadButtons />
      </div>

      <div
        className="fade-up mt-6 text-[12px] text-white/35"
        style={{ animationDelay: '0.24s' }}
      >
        macOS 12+ · Windows 10+ · Free during beta
      </div>
    </section>
  )
}
