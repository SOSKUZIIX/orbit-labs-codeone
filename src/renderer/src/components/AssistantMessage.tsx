import { useEffect, useState } from 'react'
import type { Message, QuestionAnswer, UICard } from '@shared/types'
import { Markdown } from '../lib/markdown'
import { ChevronDown, ChevronRight, HistoryIcon } from './Icons'
import { QuestionCard, formatAnswers } from './cards/QuestionCard'
import { PlanCard } from './cards/PlanCard'
import { PermissionCard } from './cards/PermissionCard'
import { TodosCard } from './cards/TodosCard'
import { FileEditsCard } from './cards/FileEditsCard'

interface Props {
  message: Message
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

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function AssistantMessage({
  message,
  streaming,
  onRestoreCheckpoint,
  onRespondToCard,
  onOpenFile
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!streaming) return
    const t = setInterval(() => setTick((n) => n + 1), 100)
    return () => clearInterval(t)
  }, [streaming])

  const hasThinking = !!(message.thinking && message.thinking.length > 0)
  const hasContent = message.content.length > 0
  const hasCards = !!(message.cards && message.cards.length > 0)
  const elapsedSinceCreated = Date.now() - message.createdAt

  let thinkingHeader: string | null = null
  if (hasThinking || streaming) {
    if (streaming && !hasContent && !hasCards) {
      thinkingHeader = `Thinking… ${formatMs(elapsedSinceCreated)}`
    } else if (message.thinkingMs != null) {
      thinkingHeader = `Thought for ${formatMs(message.thinkingMs)}`
    } else if (hasThinking) {
      thinkingHeader = 'Thoughts'
    }
  }

  const showDots = streaming && !hasContent && !hasCards

  function submitQuestion(
    cardId: string,
    answers: Record<string, QuestionAnswer>
  ): void {
    if (!onRespondToCard || !message.cards) return
    const card = message.cards.find(
      (c): c is Extract<UICard, { type: 'question' }> =>
        c.cardId === cardId && c.type === 'question'
    )
    if (!card) return
    const text = formatAnswers(card, answers)
    onRespondToCard(message.id, cardId, text, {
      answers,
      status: 'submitted'
    } as Partial<UICard>)
  }

  function planAction(cardId: string, decision: 'cancel' | 'proceed'): void {
    if (!onRespondToCard) return
    const text = decision === 'proceed' ? 'Proceed' : 'Cancel'
    onRespondToCard(message.id, cardId, text, {
      status: decision === 'proceed' ? 'proceeded' : 'cancelled'
    } as Partial<UICard>)
  }

  function permissionAction(
    cardId: string,
    decision: 'denied' | 'allowed' | 'always'
  ): void {
    if (!onRespondToCard) return
    const map = {
      denied: 'permission:denied',
      allowed: 'permission:allowed',
      always: 'permission:always'
    } as const
    onRespondToCard(message.id, cardId, map[decision], {
      status: decision
    } as Partial<UICard>)
  }

  return (
    <div className="msg assistant-msg">
      {thinkingHeader && (
        <div className={'thinking-block' + (open ? ' open' : '')}>
          <button
            className="thinking-toggle"
            onClick={() => setOpen((v) => !v)}
            disabled={!hasThinking}
            title={hasThinking ? 'Show reasoning' : ''}
          >
            <span className="thinking-chevron">
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
            <span className="thinking-label">{thinkingHeader}</span>
            {showDots && <Dots />}
          </button>
          {open && hasThinking && (
            <div className="thinking-content">
              <Markdown source={message.thinking ?? ''} />
            </div>
          )}
        </div>
      )}
      {hasContent && (
        <div className="msg-content">
          <Markdown source={message.content} />
        </div>
      )}
      {showDots && (
        <div className="assistant-working" aria-label="Assistant is working">
          <Dots />
        </div>
      )}
      {hasCards && (
        <div className="msg-cards">
          {message.cards!.map((card) => {
            switch (card.type) {
              case 'question':
                return (
                  <QuestionCard
                    key={card.cardId}
                    card={card}
                    onSubmit={submitQuestion}
                  />
                )
              case 'plan':
                return (
                  <PlanCard
                    key={card.cardId}
                    card={card}
                    onCancel={(id) => planAction(id, 'cancel')}
                    onProceed={(id) => planAction(id, 'proceed')}
                    onOpenDoc={(p) => onOpenFile?.(p)}
                  />
                )
              case 'permission':
                return (
                  <PermissionCard
                    key={card.cardId}
                    card={card}
                    onDecide={permissionAction}
                  />
                )
              case 'todos':
                return <TodosCard key={card.cardId} card={card} />
              case 'file-edits':
                return (
                  <FileEditsCard
                    key={card.cardId}
                    card={card}
                    onOpenFile={(p) => onOpenFile?.(p)}
                  />
                )
              default:
                return null
            }
          })}
        </div>
      )}
      {!streaming && message.workingMs != null && (
        <div className="msg-meta-row">
          <span className="msg-meta">
            Generated in {formatMs(message.workingMs)}
          </span>
          {message.checkpointId && onRestoreCheckpoint && (
            <button
              className="restore-checkpoint-btn"
              onClick={() => onRestoreCheckpoint(message.checkpointId!)}
              title="Restore workspace files to the state they were in when you sent this message"
            >
              <HistoryIcon size={11} />
              <span>Restore checkpoint</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Dots(): JSX.Element {
  return (
    <span className="dots" aria-label="thinking">
      <span />
      <span />
      <span />
    </span>
  )
}
