import { useEffect, useRef } from 'react'
import type { Message, UICard } from '@shared/types'
import { Markdown } from '../lib/markdown'
import { AssistantMessage } from './AssistantMessage'

interface Props {
  messages: Message[]
  streaming: boolean
  onRestoreCheckpoint?: (checkpointId: string) => void
  onRespondToCard?: (
    messageId: string,
    cardId: string,
    text: string,
    cardPatch: Partial<UICard>
  ) => void
  onOpenFile?: (path: string) => void
}

export function MessageList({
  messages,
  streaming,
  onRestoreCheckpoint,
  onRespondToCard,
  onOpenFile
}: Props): JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length, messages[messages.length - 1]?.content, streaming])

  return (
    <div className="messages">
      <div className="msg-wrap">
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="msg user-msg">
                <div className="msg-bubble">
                  <Markdown source={m.content} />
                </div>
              </div>
            )
          }
          const isLast = i === messages.length - 1
          return (
            <AssistantMessage
              key={m.id}
              message={m}
              streaming={streaming && isLast}
              onRestoreCheckpoint={onRestoreCheckpoint}
              onRespondToCard={onRespondToCard}
              onOpenFile={onOpenFile}
            />
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
