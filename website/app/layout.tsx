import type { Metadata } from 'next'
import { Background } from '@/components/Background'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeOne — The AI coding workspace by Orbit Labs',
  description:
    'A multi-provider AI coding workspace with built-in agent, terminal, and preview. Bring your own keys, or use Orbit 1.2 for free.',
  metadataBase: new URL('https://codeone.orbitlabs.dev'),
  openGraph: {
    title: 'CodeOne — The AI coding workspace',
    description:
      'A multi-provider AI coding workspace with built-in agent, terminal, and preview.',
    type: 'website'
  }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <html lang="en">
      <body className="font-sans">
        <Background />
        {children}
      </body>
    </html>
  )
}
