export function Footer(): JSX.Element {
  return (
    <footer className="border-t border-white/5 bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="CodeOne"
              className="h-10 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <span className="text-base font-medium tracking-tight">CodeOne</span>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/45">
            A multi-provider AI coding workspace by Orbit Labs. Built for the
            way you actually ship.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { href: '/#features', label: 'Features' },
            { href: '/#orbit', label: 'Orbit 1.2' },
            { href: '/#download', label: 'Download' },
            { href: '/releases', label: 'Releases' }
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { href: 'https://x.com/orbitlabs', label: 'X / Twitter' },
            { href: 'mailto:hello@orbitlabs.dev', label: 'Contact' }
          ]}
        />
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-6 text-[12px] text-white/35 sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} Orbit Labs. All rights reserved.</div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white/70">
              Privacy
            </a>
            <a href="#" className="hover:text-white/70">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  links
}: {
  title: string
  links: { href: string; label: string }[]
}): JSX.Element {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="text-[13px] text-white/65 transition hover:text-white"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
