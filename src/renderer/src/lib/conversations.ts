import type { Conversation } from '@shared/types'

// Conversations are stored locally on disk by the main process (see
// src/main/store.ts, conversations.json). No cloud, no account — chat history
// never leaves the machine.

export async function listConversations(): Promise<Conversation[]> {
  return window.orbit.conversations.list()
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await window.orbit.conversations.save(conv)
}

export async function deleteConversation(id: string): Promise<void> {
  await window.orbit.conversations.delete(id)
}
