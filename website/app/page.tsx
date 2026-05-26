import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { Demo } from '@/components/Demo'
import { Features } from '@/components/Features'
import { OrbitCallout } from '@/components/OrbitCallout'
import { Footer } from '@/components/Footer'

export default function Page(): JSX.Element {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <Hero />
      <Demo />
      <Features />
      <OrbitCallout />
      <Footer />
    </main>
  )
}
