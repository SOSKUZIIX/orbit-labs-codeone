import type { Provider, StreamArgs, EmitFn } from './types'
import { streamLocal } from './local-runtime'

/**
 * "Local (offline)" — advanced offline provider. Runs a locally-served model
 * tag over loopback (Ollama etc.). Bring-your-own-model counterpart to the
 * branded Orbit provider. See docs/offline-setup.md.
 */
const LOCAL_MODEL_MAP: Record<string, string> = {
  'qwen2.5-coder:32b': 'qwen2.5-coder:32b'
}

export const localProvider: Provider = {
  id: 'local',
  async stream(args: StreamArgs, emit: EmitFn) {
    return streamLocal(args, emit, { modelMap: LOCAL_MODEL_MAP, label: 'local' })
  }
}
