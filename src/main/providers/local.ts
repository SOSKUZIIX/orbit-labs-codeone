import type { Provider, StreamArgs, EmitFn } from './types'
import { streamLocal } from './local-runtime'
import { resolveOrbitModelTag } from '../orbit-model'

/**
 * "Orbit 1.4" — the offline coding agent. A brand, not a fixed model: it runs
 * the largest Qwen2.5-Coder tier this machine can hold (see orbit-model.ts).
 * The display name is always "Orbit 1.4"; the tag is resolved under the hood.
 */
export const localProvider: Provider = {
  id: 'local',
  async stream(args: StreamArgs, emit: EmitFn) {
    const model = await resolveOrbitModelTag(args.model)
    return streamLocal({ ...args, model }, emit, { modelMap: {}, label: 'local' })
  }
}
