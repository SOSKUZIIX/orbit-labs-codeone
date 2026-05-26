import type { ProviderId } from '@shared/types'
import { PROVIDERS, getProvider } from '@shared/providers'

interface Props {
  provider: ProviderId
  model: string
  onChange: (provider: ProviderId, model: string) => void
}

export function ModelPicker({ provider, model, onChange }: Props): JSX.Element {
  const info = getProvider(provider)
  return (
    <>
      <div className="picker">
        <label>Provider</label>
        <select
          value={provider}
          onChange={(e) => {
            const next = e.target.value as ProviderId
            const first = getProvider(next)?.models[0] ?? model
            onChange(next, first)
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="picker">
        <label>Model</label>
        <select value={model} onChange={(e) => onChange(provider, e.target.value)}>
          {info?.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
