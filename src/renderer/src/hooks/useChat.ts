import { useEffect, useRef, useState, useCallback } from 'react'
import type {
  AppSettings,
  ChatEvent,
  Conversation,
  Message,
  ProviderId,
  UICard
} from '@shared/types'

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return trimmed.length <= 48 ? trimmed : trimmed.slice(0, 48) + '…'
}

export interface SendExtras {
  assistantCheckpointId?: string
  workspaceRoot?: string | null
  hidden?: boolean
}

export interface CardResponse {
  text: string
  cardPatch: Partial<UICard>
}

export interface UseChat {
  conversation: Conversation
  setConversation: (c: Conversation) => void
  busy: boolean
  queuedCount: number
  error: string | null
  send: (text: string, extras?: SendExtras) => Promise<void>
  cancel: () => void
  reset: (provider: ProviderId, model: string) => void
  respondToCard: (
    messageId: string,
    cardId: string,
    response: CardResponse,
    workspaceRoot?: string | null
  ) => Promise<void>
}

export function useChat(
  initial: Conversation,
  settings: AppSettings,
  onPersist: (c: Conversation) => void
): UseChat {
  const [conversation, setConversationState] = useState<Conversation>(initial)
  const [busy, setBusy] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const queueRef = useRef<Array<{ text: string; extras?: SendExtras }>>([])
  const convRef = useRef(conversation)
  convRef.current = conversation

  // Per-request timing state (request id → timestamps)
  const startedAtRef = useRef<Map<string, number>>(new Map())
  const firstTokenAtRef = useRef<Map<string, number>>(new Map())

  const setConversation = useCallback((c: Conversation) => {
    setConversationState(c)
    convRef.current = c
  }, [])

  function patchLastAssistant(
    conv: Conversation,
    patch: Partial<Message>
  ): Conversation {
    const last = conv.messages[conv.messages.length - 1]
    if (!last || last.role !== 'assistant') return conv
    return {
      ...conv,
      updatedAt: Date.now(),
      messages: [
        ...conv.messages.slice(0, -1),
        { ...last, ...patch, ...{ /* allow shallow merge */ } }
      ]
    }
  }

  function appendOrReplaceCard(
    cards: UICard[] | undefined,
    next: UICard
  ): UICard[] {
    const list = cards ? [...cards] : []
    const idx = list.findIndex((c) => c.cardId === next.cardId)
    if (idx >= 0) list[idx] = next
    else list.push(next)
    return list
  }

  const startTurn = useCallback(
    async (text: string, extras?: SendExtras) => {
      setError(null)
      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: text,
        createdAt: Date.now()
      }
      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: '',
        thinking: '',
        createdAt: Date.now(),
        checkpointId: extras?.assistantCheckpointId
      }
      const conv = convRef.current
      const next: Conversation = {
        ...conv,
        title: conv.messages.length === 0 ? deriveTitle(text) : conv.title,
        messages: [...conv.messages, userMsg, assistantMsg],
        updatedAt: Date.now()
      }
      setConversation(next)
      onPersist(next)

      const requestId = uid()
      requestIdRef.current = requestId
      startedAtRef.current.set(requestId, Date.now())
      setBusy(true)
      const planSuffix =
        next.mode === 'plan'
          ? '\n\nYou are in PLAN MODE. Ask clarifying questions only if needed, then do not produce code or file edits yet. Instead, write a concise, numbered plan describing what you would do, the files involved, and the tradeoffs. End with "Reply with `go` to proceed." so the user can approve.'
          : '\n\nYou are in AGENT MODE. Do not ask the user clarifying questions unless the request is impossible or unsafe without an answer. Make reasonable assumptions and proceed.'
      await window.orbit.chat.start({
        requestId,
        provider: next.provider,
        model: next.model,
        messages: [...next.messages.slice(0, -1)],
        systemPrompt: settings.systemPrompt + planSuffix,
        temperature: settings.temperature,
        workspaceRoot: extras?.workspaceRoot ?? null,
        mode: next.mode
      })
    },
    [
      onPersist,
      settings.systemPrompt,
      settings.temperature,
      setConversation
    ]
  )

  const runNextQueued = useCallback(() => {
    const next = queueRef.current.shift()
    setQueuedCount(queueRef.current.length)
    if (next) {
      window.setTimeout(() => void startTurn(next.text, next.extras), 0)
    }
  }, [startTurn])

  useEffect(() => {
    const off = window.orbit.chat.onEvent((ev: ChatEvent) => {
      if (ev.requestId !== requestIdRef.current) return
      const conv = convRef.current
      const last = conv.messages[conv.messages.length - 1]
      if (!last || last.role !== 'assistant') return

      if (ev.kind === 'thinking-delta') {
        const next = patchLastAssistant(conv, {
          thinking: (last.thinking ?? '') + ev.text
        })
        setConversation(next)
        onPersist(next)
      } else if (ev.kind === 'card') {
        const next = patchLastAssistant(conv, {
          cards: appendOrReplaceCard(last.cards, ev.card)
        })
        setConversation(next)
        onPersist(next)
      } else if (ev.kind === 'delta') {
        // First content token → record thinking time.
        if (!firstTokenAtRef.current.has(ev.requestId)) {
          firstTokenAtRef.current.set(ev.requestId, Date.now())
          const startedAt = startedAtRef.current.get(ev.requestId)
          const thinkingMs = startedAt ? Date.now() - startedAt : undefined
          const next = patchLastAssistant(conv, {
            content: last.content + ev.text,
            thinkingMs
          })
          setConversation(next)
          onPersist(next)
          return
        }
        const next = patchLastAssistant(conv, {
          content: last.content + ev.text
        })
        setConversation(next)
        onPersist(next)
      } else if (ev.kind === 'done') {
        const startedAt = startedAtRef.current.get(ev.requestId)
        const firstTokenAt = firstTokenAtRef.current.get(ev.requestId)
        const completedAt = Date.now()
        const thinkingMs =
          firstTokenAt && startedAt ? firstTokenAt - startedAt : undefined
        const workingMs = firstTokenAt
          ? completedAt - firstTokenAt
          : startedAt
            ? completedAt - startedAt
            : undefined
        const next = patchLastAssistant(conv, { thinkingMs, workingMs })
        setConversation(next)
        startedAtRef.current.delete(ev.requestId)
        firstTokenAtRef.current.delete(ev.requestId)
        setBusy(false)
        requestIdRef.current = null
        onPersist(next)
        runNextQueued()
      } else if (ev.kind === 'error') {
        setError(ev.message)
        setBusy(false)
        requestIdRef.current = null
        startedAtRef.current.delete(ev.requestId)
        firstTokenAtRef.current.delete(ev.requestId)
        // Drop the empty assistant placeholder if it has nothing.
        if (last && last.role === 'assistant' && !last.content && !last.thinking) {
          const next: Conversation = {
            ...conv,
            messages: conv.messages.slice(0, -1)
          }
          setConversation(next)
          onPersist(next)
        }
        runNextQueued()
      }
    })
    return off
  }, [onPersist, runNextQueued, setConversation, startTurn])

  const send = useCallback(
    async (text: string, extras?: SendExtras) => {
      if (requestIdRef.current) {
        queueRef.current.push({ text, extras })
        setQueuedCount(queueRef.current.length)
        return
      }
      await startTurn(text, extras)
    },
    [startTurn]
  )

  const respondToCard = useCallback(
    async (
      messageId: string,
      cardId: string,
      response: CardResponse,
      workspaceRoot?: string | null
    ) => {
      // Patch the card on the targeted assistant message.
      const conv = convRef.current
      const idx = conv.messages.findIndex((m) => m.id === messageId)
      if (idx < 0) return
      const target = conv.messages[idx]
      if (!target.cards) return
      const nextCards = target.cards.map((c) =>
        c.cardId === cardId
          ? ({ ...c, ...response.cardPatch } as UICard)
          : c
      )
      const updatedTarget: Message = { ...target, cards: nextCards }
      const updated: Conversation = {
        ...conv,
        updatedAt: Date.now(),
        messages: [
          ...conv.messages.slice(0, idx),
          updatedTarget,
          ...conv.messages.slice(idx + 1)
        ]
      }
      setConversation(updated)
      onPersist(updated)
      // Then send the response as a follow-up user message.
      await send(response.text, { workspaceRoot })
    },
    [onPersist, send, setConversation]
  )

  const cancel = useCallback(() => {
    const id = requestIdRef.current
    if (id) window.orbit.chat.cancel(id)
  }, [])

  const reset = useCallback(
    (provider: ProviderId, model: string) => {
      const fresh: Conversation = {
        id: uid(),
        title: 'New chat',
        provider,
        model,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mode: convRef.current.mode ?? 'agent'
      }
      setConversation(fresh)
    },
    [setConversation]
  )

  return {
    conversation,
    setConversation,
    busy,
    queuedCount,
    error,
    send,
    cancel,
    reset,
    respondToCard
  }
}
