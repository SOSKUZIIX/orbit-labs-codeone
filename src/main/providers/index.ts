import type { ProviderId } from '@shared/types'
import type { Provider } from './types'
import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'
import { googleProvider } from './google'
import { orbitProvider } from './orbit'
import { localProvider } from './local'

const REGISTRY: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
  orbit: orbitProvider,
  local: localProvider
}

export function getProvider(id: ProviderId): Provider {
  const p = REGISTRY[id]
  if (!p) throw new Error(`Unknown provider: ${id}`)
  return p
}
