import { supabase } from './supabase'

const LIMIT = 10

export async function listRecents(): Promise<string[]> {
  const { data, error } = await supabase
    .from('recent_folders')
    .select('path, last_opened_at')
    .order('last_opened_at', { ascending: false })
    .limit(LIMIT)
  if (error) {
    console.error('listRecents', error)
    return []
  }
  return (data ?? []).map((r) => r.path as string)
}

export async function recordRecent(path: string): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser()
  const userId = userResp.user?.id
  if (!userId) return
  const { error } = await supabase
    .from('recent_folders')
    .upsert(
      { user_id: userId, path, last_opened_at: new Date().toISOString() },
      { onConflict: 'user_id,path' }
    )
  if (error) console.error('recordRecent', error)
}
