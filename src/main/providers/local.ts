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
    try {
      return await streamLocal({ ...args, model }, emit, { modelMap: {}, label: 'local' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // A connection failure to loopback means the local runtime isn't running.
      if (/fetch failed|ECONNREFUSED|econnrefused|network|refused/i.test(msg)) {
        throw new Error(
          "Can't reach the offline Orbit engine. Install the local runtime from ollama.com, make sure it's running, then try again."
        )
      }
      throw err
    }
  }
}
