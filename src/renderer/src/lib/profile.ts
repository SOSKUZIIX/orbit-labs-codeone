import { supabase } from './supabase'

export type UsageType = 'personal' | 'work' | 'school'
export type TeamSize = 'solo' | '2-10' | '11-50' | '50+'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: string
  onboarded: boolean
  usage_type: UsageType | null
  role_title: string | null
  team_size: TeamSize | null
  referral_source: string | null
}

const SELECT_COLS =
  'id, email, display_name, role, onboarded, usage_type, role_title, team_size, referral_source'

export async function getProfile(): Promise<Profile | null> {
  const { data: userResp } = await supabase.auth.getUser()
  const userId = userResp.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('users')
    .select(SELECT_COLS)
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('getProfile', error)
    return null
  }
  return data as Profile | null
}

export async function updateProfile(patch: {
  display_name?: string | null
  onboarded?: boolean
  usage_type?: UsageType | null
  role_title?: string | null
  team_size?: TeamSize | null
  referral_source?: string | null
}): Promise<Profile | null> {
  const { data: userResp } = await supabase.auth.getUser()
  const userId = userResp.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select(SELECT_COLS)
    .maybeSingle()
  if (error) {
    console.error('updateProfile', error)
    return null
  }
  return data as Profile | null
}
