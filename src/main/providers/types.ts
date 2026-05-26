import type {
  AgentMode,
  Message,
  ProviderId,
  UICard
} from '@shared/types'

export interface StreamArgs {
  apiKey: string
  model: string
  messages: Message[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  signal: AbortSignal
  workspaceRoot?: string | null
  mode?: AgentMode
}

export type StreamEvent =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'card'; card: UICard }

export type EmitFn = (event: StreamEvent) => void

// Backwards-compatible adapter so older providers can still call onDelta(text).
export type DeltaChannel = 'thinking' | 'content'
export type DeltaCallback = (text: string, channel?: DeltaChannel) => void

export function deltaAdapter(emit: EmitFn): DeltaCallback {
  return (text, channel) =>
    emit({ type: channel === 'thinking' ? 'thinking' : 'content', text })
}

export interface Provider {
  id: ProviderId
  stream(args: StreamArgs, emit: EmitFn): Promise<void>
}
