import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signed-in'; session: Session }
  | { status: 'signed-out'; session: null }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setState(
        data.session
          ? { status: 'signed-in', session: data.session }
          : { status: 'signed-out', session: null }
      )
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(
        session
          ? { status: 'signed-in', session }
          : { status: 'signed-out', session: null }
      )
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
