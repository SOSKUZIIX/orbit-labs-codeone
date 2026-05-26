import { useLayoutEffect, useState } from 'react'
import type { Profile, TeamSize, UsageType } from '../lib/profile'
import { updateProfile } from '../lib/profile'

type Phase = 'survey' | 'tour' | 'done'

interface Props {
  profile: Profile
  onComplete: (next: Profile) => void
  onSkip: () => void
}

interface Answers {
  usage_type: UsageType | null
  team_size: TeamSize | null
  role_title: string
  referral_source: string
}

export function Onboarding({ profile, onComplete, onSkip }: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>('survey')
  const [answers, setAnswers] = useState<Answers>({
    usage_type: profile.usage_type,
    team_size: profile.team_size,
    role_title: profile.role_title ?? '',
    referral_source: profile.referral_source ?? ''
  })

  async function finish(): Promise<void> {
    const next = await updateProfile({
      onboarded: true,
      usage_type: answers.usage_type,
      team_size: answers.usage_type === 'work' ? answers.team_size : null,
      role_title: answers.role_title.trim() || null,
      referral_source: answers.referral_source.trim() || null
    })
    setPhase('done')
    if (next) onComplete(next)
  }

  if (phase === 'survey') {
    return (
      <PersonaSurvey
        answers={answers}
        onChange={setAnswers}
        onSubmit={() => setPhase('tour')}
        onSkip={onSkip}
      />
    )
  }

  if (phase === 'tour') {
    return <Tour onFinish={() => void finish()} onSkip={() => void finish()} />
  }

  return <></>
}

// -------------------- Persona survey --------------------

interface SurveyProps {
  answers: Answers
  onChange: (a: Answers) => void
  onSubmit: () => void
  onSkip: () => void
}

const USAGE_OPTIONS: { id: UsageType; label: string; sub: string }[] = [
  { id: 'personal', label: 'Personal', sub: 'Side projects, learning, hobby code' },
  { id: 'work', label: 'Work', sub: 'My job or my company' },
  { id: 'school', label: 'School', sub: 'Coursework, research, students' }
]

const TEAM_OPTIONS: TeamSize[] = ['solo', '2-10', '11-50', '50+']
const ROLE_OPTIONS = [
  'Developer',
  'Designer',
  'Product Manager',
  'Student',
  'Founder',
  'Other'
]
const REFERRAL_OPTIONS = [
  'Twitter / X',
  'YouTube',
  'Friend or colleague',
  'Hacker News',
  'Reddit',
  'Search',
  'Other'
]

function PersonaSurvey({
  answers,
  onChange,
  onSubmit,
  onSkip
}: SurveyProps): JSX.Element {
  const [step, setStep] = useState(0)

  const needsTeamSize = answers.usage_type === 'work'
  const totalSteps = needsTeamSize ? 4 : 3
  const stepIndex = (() => {
    if (step === 0) return 0
    if (step === 1 && needsTeamSize) return 1
    if (step === 1 && !needsTeamSize) return 1
    if (step === 2 && needsTeamSize) return 2
    if (step === 2 && !needsTeamSize) return 2
    return 3
  })()

  function next(): void {
    if (step === 0 && !needsTeamSize) setStep(2)
    else setStep(step + 1)
  }
  function back(): void {
    if (step === 2 && !needsTeamSize) setStep(0)
    else setStep(Math.max(0, step - 1))
  }

  const canAdvance =
    (step === 0 && !!answers.usage_type) ||
    (step === 1 && needsTeamSize && !!answers.team_size) ||
    (step === 2 && !!answers.role_title.trim()) ||
    (step === 3 && !!answers.referral_source.trim())

  const isLast =
    (step === 3 && needsTeamSize) || (step === 3 && !needsTeamSize)

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={'onboarding-dot' + (i === stepIndex ? ' active' : '')}
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2>How will you use CodeOne?</h2>
            <p className="onboarding-sub">
              We'll tailor the experience to what you need.
            </p>
            <div className="onboarding-options">
              {USAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={
                    'onboarding-option' +
                    (answers.usage_type === opt.id ? ' selected' : '')
                  }
                  onClick={() => onChange({ ...answers, usage_type: opt.id })}
                >
                  <div className="onboarding-option-label">{opt.label}</div>
                  <div className="onboarding-option-sub">{opt.sub}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && needsTeamSize && (
          <>
            <h2>How big is your team?</h2>
            <p className="onboarding-sub">Just the engineering side counts.</p>
            <div className="onboarding-options grid-2">
              {TEAM_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={
                    'onboarding-option' +
                    (answers.team_size === s ? ' selected' : '')
                  }
                  onClick={() => onChange({ ...answers, team_size: s })}
                >
                  <div className="onboarding-option-label">{s}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>What's your role?</h2>
            <p className="onboarding-sub">Pick one or type your own.</p>
            <div className="onboarding-options grid-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  className={
                    'onboarding-option' +
                    (answers.role_title === r ? ' selected' : '')
                  }
                  onClick={() => onChange({ ...answers, role_title: r })}
                >
                  <div className="onboarding-option-label">{r}</div>
                </button>
              ))}
            </div>
            <input
              className="auth-input"
              style={{ marginTop: 12 }}
              placeholder="Or type your own"
              value={
                ROLE_OPTIONS.includes(answers.role_title) ? '' : answers.role_title
              }
              onChange={(e) =>
                onChange({ ...answers, role_title: e.target.value })
              }
            />
          </>
        )}

        {step === 3 && (
          <>
            <h2>How did you hear about us?</h2>
            <p className="onboarding-sub">Helps us know what's working.</p>
            <div className="onboarding-options grid-2">
              {REFERRAL_OPTIONS.map((r) => (
                <button
                  key={r}
                  className={
                    'onboarding-option' +
                    (answers.referral_source === r ? ' selected' : '')
                  }
                  onClick={() => onChange({ ...answers, referral_source: r })}
                >
                  <div className="onboarding-option-label">{r}</div>
                </button>
              ))}
            </div>
            <input
              className="auth-input"
              style={{ marginTop: 12 }}
              placeholder="Or describe in your own words"
              value={
                REFERRAL_OPTIONS.includes(answers.referral_source)
                  ? ''
                  : answers.referral_source
              }
              onChange={(e) =>
                onChange({ ...answers, referral_source: e.target.value })
              }
            />
          </>
        )}

        <div className="onboarding-actions">
          <button className="auth-link" onClick={onSkip}>
            Skip
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button className="ghost-btn" onClick={back}>
              Back
            </button>
          )}
          <button
            className="welcome-primary small"
            onClick={isLast ? onSubmit : next}
            disabled={!canAdvance}
          >
            {isLast ? 'Start the tour' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------- Spotlight tour --------------------

interface TourStop {
  selector: string
  title: string
  body: string
}

const STOPS: TourStop[] = [
  {
    selector: '[data-tour="open-workspace"]',
    title: 'Open a workspace',
    body: "Point CodeOne at any folder on your machine. It becomes your project — files in the explorer, edits in the editor, agent on the right."
  },
  {
    selector: '[data-tour="settings"]',
    title: 'Bring your own AI keys',
    body: "Click here to open Settings, then add your Anthropic, OpenAI, or Google API keys under 'API Keys'. Until OrbitOne (our own model) ships, CodeOne uses your keys directly — billed by the provider, not us."
  },
  {
    selector: '[data-tour="composer"]',
    title: 'Talk to the agent',
    body: "Type here to chat. The agent can read your files, edit code, and run commands. Try: 'What does this project do?'"
  },
  {
    selector: '[data-tour="toggle-terminal"]',
    title: 'Built-in terminal',
    body: "A full shell, scoped to your workspace folder. Toggle it any time with ⌘`."
  }
]

function Tour({
  onFinish,
  onSkip
}: {
  onFinish: () => void
  onSkip: () => void
}): JSX.Element {
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const stop = STOPS[idx]

  useLayoutEffect(() => {
    function measure(): void {
      const el = document.querySelector(stop.selector) as HTMLElement | null
      if (!el) {
        setRect(null)
        return
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setRect(el.getBoundingClientRect())
    }
    measure()
    window.addEventListener('resize', measure)
    const interval = window.setInterval(measure, 250)
    return () => {
      window.removeEventListener('resize', measure)
      window.clearInterval(interval)
    }
  }, [stop.selector])

  function next(): void {
    if (idx + 1 < STOPS.length) setIdx(idx + 1)
    else onFinish()
  }

  const PAD = 8
  const cardWidth = 320
  const cardHeight = 180
  const winW = window.innerWidth
  const winH = window.innerHeight

  let cardLeft = 24
  let cardTop = 24
  if (rect) {
    cardLeft = Math.min(
      Math.max(rect.left, 16),
      winW - cardWidth - 16
    )
    const below = rect.bottom + PAD + cardHeight + 16 < winH
    cardTop = below ? rect.bottom + PAD : Math.max(16, rect.top - cardHeight - PAD)
  }

  const cutout = rect
    ? {
        x: rect.left - PAD,
        y: rect.top - PAD,
        w: rect.width + PAD * 2,
        h: rect.height + PAD * 2
      }
    : null

  return (
    <div className="tour-root">
      <svg
        className="tour-overlay"
        width="100%"
        height="100%"
        onClick={next}
      >
        <defs>
          <mask id="tour-cutout">
            <rect width="100%" height="100%" fill="white" />
            {cutout && (
              <rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.w}
                height={cutout.h}
                rx={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 6, 10, 0.72)"
          mask="url(#tour-cutout)"
        />
        {cutout && (
          <rect
            x={cutout.x}
            y={cutout.y}
            width={cutout.w}
            height={cutout.h}
            rx={10}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={1}
          />
        )}
      </svg>
      <div
        className="tour-card"
        style={{ left: cardLeft, top: cardTop, width: cardWidth }}
      >
        <div className="tour-step">
          Step {idx + 1} of {STOPS.length}
        </div>
        <h3>{stop.title}</h3>
        <p>{stop.body}</p>
        <div className="tour-actions">
          <button className="auth-link" onClick={onSkip}>
            Skip tour
          </button>
          <div style={{ flex: 1 }} />
          <button className="welcome-primary small" onClick={next}>
            {idx + 1 === STOPS.length ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
