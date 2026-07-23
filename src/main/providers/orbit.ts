import type { Provider, StreamArgs, EmitFn } from './types'
import { streamLocal } from './local-runtime'

/**
 * "Orbit 1.2" — Orbit Labs' branded offline coding model. Runs entirely on the
 * user's machine via the local runtime (no API key, no account, no network
 * egress). Today it maps to the open-weight Qwen2.5-Coder 32B; this is the
 * model slot that will later point at Orbit Labs' own fine-tune.
 *
 * (Previously this proxied to OpenAI gpt-5.5 over the network behind a Supabase
 * usage gate — removed in the offline pivot.)
 */
const ORBIT_MODEL_MAP: Record<string, string> = {
  'Orbit 1.2': 'qwen2.5-coder:32b',
  'orbit-1.2': 'qwen2.5-coder:32b'
}

export const orbitProvider: Provider = {
  id: 'orbit',
  async stream(args: StreamArgs, emit: EmitFn) {
    return streamLocal(args, emit, { modelMap: ORBIT_MODEL_MAP, label: 'orbit' })
  }
}
