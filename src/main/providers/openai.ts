import type { Provider, StreamArgs, EmitFn } from './types'
import { streamOpenAICompatible } from './openai-core'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export const openaiProvider: Provider = {
  id: 'openai',
  async stream(args: StreamArgs, emit: EmitFn) {
    return streamOpenAICompatible(args, emit, {
      endpoint: ENDPOINT,
      apiKey: args.apiKey,
      allowParallelToolCalls: true,
      label: 'openai'
    })
  }
}
