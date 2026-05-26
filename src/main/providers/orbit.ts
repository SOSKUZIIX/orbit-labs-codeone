import type { Provider, StreamArgs, EmitFn } from './types'
import { openaiProvider } from './openai'

const ORBIT_MODEL_MAP: Record<string, string> = {
  'Orbit 1.2': 'gpt-5.5',
  'orbit-1.2': 'gpt-5.5'
}

export const orbitProvider: Provider = {
  id: 'orbit',
  async stream(args: StreamArgs, emit: EmitFn) {
    const mapped = ORBIT_MODEL_MAP[args.model] ?? 'gpt-5.5'
    return openaiProvider.stream({ ...args, model: mapped }, emit)
  }
}
