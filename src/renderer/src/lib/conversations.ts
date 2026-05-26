import type { Conversation } from '@shared/types'
import { supabase } from './supabase'

type Row = {
  id: string
  title: string | null
  provider: Conversation['provider']
  model: string
  mode: Conversation['mode'] | null
  messages: Conversation['messages']
  created_at: string
  updated_at: string
}

function rowToConversation(r: Row): Conversation {
  return {
    id: r.id,
    title: r.title ?? 'New chat',
    provider: r.provider,
    model: r.model,
    mode: r.mode ?? undefined,
    messages: r.messages ?? [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime()
  }
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('listConversations', error)
    return []
  }
  return (data ?? []).map((r) => rowToConversation(r as Row))
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser()
  const userId = userResp.user?.id
  if (!userId) return
  const { error } = await supabase.from('conversations').upsert(
    {
      id: conv.id,
      user_id: userId,
      title: conv.title,
      provider: conv.provider,
      model: conv.model,
      mode: conv.mode ?? null,
      messages: conv.messages,
      created_at: new Date(conv.createdAt).toISOString(),
      updated_at: new Date(conv.updatedAt).toISOString()
    },
    { onConflict: 'id' }
  )
  if (error) console.error('saveConversation', error)
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) console.error('deleteConversation', error)
}
