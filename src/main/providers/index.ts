import type { ProviderId } from '@shared/types'
import type { Provider } from './types'
import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'
import { googleProvider } from './google'
import { orbitProvider } from './orbit'

const REGISTRY: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
  orbit: orbitProvider
}

export function getProvider(id: ProviderId): Provider {
  const p = REGISTRY[id]
  if (!p) throw new Error(`Unknown provider: ${id}`)
  return p
}
