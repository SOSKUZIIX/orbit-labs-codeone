// Local, offline profile. Stored in the renderer's localStorage — never sent
// anywhere. Keeps the same shape the UI already expects so the onboarding survey
// and Settings display-name field keep working without any backend.

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

const STORAGE_KEY = 'codeone.profile'

const DEFAULT_PROFILE: Profile = {
  id: 'local',
  email: '',
  display_name: null,
  role: 'local',
  onboarded: false,
  usage_type: null,
  role_title: null,
  team_size: null,
  referral_source: null
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export async function updateProfile(patch: {
  display_name?: string | null
  onboarded?: boolean
  usage_type?: UsageType | null
  role_title?: string | null
  team_size?: TeamSize | null
  referral_source?: string | null
}): Promise<Profile | null> {
  const current = (await getProfile()) ?? { ...DEFAULT_PROFILE }
  const next: Profile = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — keep in-memory value */
  }
  return next
}
