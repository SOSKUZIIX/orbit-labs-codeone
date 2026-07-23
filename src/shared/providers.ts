import type { ProviderId, ProviderInfo } from './types'

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Claude',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    models: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001'
    ]
  },
  {
    id: 'openai',
    label: 'GPT',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    models: [
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'gpt-5.1',
      'gpt-5.1-mini',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o3-mini'
    ]
  },
  {
    id: 'google',
    label: 'Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza...',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro'
    ]
  },
  {
    id: 'local',
    label: 'Orbit',
    docsUrl: 'https://codeone.orbitlabs.dev',
    keyPlaceholder: '',
    models: ['Orbit 1.4']
  }
]

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export interface ModelEntry {
  id: string
  provider: ProviderId
}

/** Flat list of every selectable model, in display order. */
export const ALL_MODELS: ModelEntry[] = PROVIDERS.flatMap((p) =>
  p.models.map((id) => ({ id, provider: p.id }))
)

export function findModel(id: string): ModelEntry | undefined {
  return ALL_MODELS.find((m) => m.id === id)
}

/** Offline engines that run on the local loopback runtime — always available. */
export const OFFLINE_PROVIDER_IDS: ProviderId[] = ['orbit', 'local']

/** Cloud providers that send data off the machine — opt-in, off by default. */
export const CLOUD_PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'google']

export function isCloudProvider(id: ProviderId): boolean {
  return CLOUD_PROVIDER_IDS.includes(id)
}
