export interface OrbitUsageResult {
  allowed: boolean
  count: number
  limit: number
  reset_at: string
  window_started_at: string
}

const ORBIT_LIMIT = 25
const ORBIT_WINDOW_HOURS = 6

/**
 * Calls the public.check_and_increment_orbit_usage RPC on Supabase using the
 * caller's JWT, so auth.uid() resolves inside the function. The RPC is
 * security definer and atomically checks + bumps the per-user counter.
 */
export async function checkAndIncrementOrbitUsage(
  authToken: string
): Promise<OrbitUsageResult> {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Supabase env vars missing in main process')
  }
  const res = await fetch(
    `${url}/rest/v1/rpc/check_and_increment_orbit_usage`,
    {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_limit: ORBIT_LIMIT })
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Orbit usage RPC failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as Array<{
    allowed: boolean
    count: number
    limit: number
    window_started_at: string
    reset_at: string
  }>
  const row = Array.isArray(data) ? data[0] : (data as never)
  if (!row) throw new Error('Orbit usage RPC returned no row')
  return row
}

export { ORBIT_LIMIT, ORBIT_WINDOW_HOURS }
