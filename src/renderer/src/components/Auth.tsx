import { useState } from 'react'
import { OrbitLogo } from './Icons'
import { supabase } from '../lib/supabase'

type Mode =
  | 'sign-in'
  | 'sign-up'
  | 'sign-up-verify'
  | 'magic-link'
  | 'magic-verify'

export function Auth(): JSX.Element {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // If email confirmation is enabled, Supabase returns a user with no session.
        // We move to OTP verification. If confirmation is disabled, the session
        // is already active and the auth listener will take over.
        if (!data.session) {
          setNotice('We sent a 6-digit code to your email.')
          setMode('sign-up-verify')
        }
      } else if (mode === 'sign-up-verify') {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: 'signup'
        })
        if (error) throw error
      } else if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true }
        })
        if (error) throw error
        setNotice('We sent a 6-digit code to your email.')
        setMode('magic-verify')
      } else if (mode === 'magic-verify') {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: 'email'
        })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const passwordMode = mode === 'sign-in' || mode === 'sign-up'
  const otpMode = mode === 'sign-up-verify' || mode === 'magic-verify'

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo">
          <OrbitLogo size={150} />
        </div>
        <h1 className="welcome-title">CodeOne</h1>
        <p className="welcome-subtitle">
          {mode === 'sign-in' && 'Sign in to continue'}
          {mode === 'sign-up' && 'Create your account'}
          {mode === 'sign-up-verify' && 'Confirm your email'}
          {mode === 'magic-link' && 'Sign in with a one-time code'}
          {mode === 'magic-verify' && 'Enter the code from your email'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!otpMode && (
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
              autoComplete="email"
            />
          )}
          {passwordMode && (
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
          )}
          {otpMode && (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="auth-input"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
              required
            />
          )}

          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-notice">{notice}</div>}

          <button className="welcome-primary" type="submit" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'sign-in'
                ? 'Sign in'
                : mode === 'sign-up'
                  ? 'Create account'
                  : mode === 'sign-up-verify'
                    ? 'Confirm email'
                    : mode === 'magic-link'
                      ? 'Send code'
                      : 'Verify code'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'sign-in' && (
            <>
              <button className="auth-link" onClick={() => setMode('sign-up')}>
                Create an account
              </button>
              <span className="auth-divider">·</span>
              <button className="auth-link" onClick={() => setMode('magic-link')}>
                Email me a code
              </button>
            </>
          )}
          {mode === 'sign-up' && (
            <button className="auth-link" onClick={() => setMode('sign-in')}>
              I already have an account
            </button>
          )}
          {(mode === 'magic-link' || mode === 'magic-verify') && (
            <button className="auth-link" onClick={() => setMode('sign-in')}>
              Use password instead
            </button>
          )}
          {mode === 'sign-up-verify' && (
            <button className="auth-link" onClick={() => setMode('sign-up')}>
              Use a different email
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
