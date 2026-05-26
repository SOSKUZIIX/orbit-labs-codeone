import { useMemo, useState } from 'react'
import type { QuestionAnswer, UICard } from '@shared/types'

type QuestionCardData = Extract<UICard, { type: 'question' }>

interface Props {
  card: QuestionCardData
  onSubmit: (cardId: string, answers: Record<string, QuestionAnswer>) => void
}

export function QuestionCard({ card, onSubmit }: Props): JSX.Element {
  const initial: Record<string, QuestionAnswer> = useMemo(() => {
    const a: Record<string, QuestionAnswer> = {}
    for (const q of card.questions) {
      a[q.id] = card.answers?.[q.id] ?? { optionIndex: null }
    }
    return a
  }, [card.questions, card.answers])

  const [answers, setAnswers] = useState(initial)
  const isSubmitted = card.status === 'submitted'

  const ready = card.questions.every((q) => {
    const a = answers[q.id]
    if (!a) return false
    if (a.optionIndex == null && !(a.other && a.other.trim())) return false
    return true
  })

  function pick(qid: string, optionIndex: number): void {
    if (isSubmitted) return
    setAnswers((cur) => ({
      ...cur,
      [qid]: { optionIndex, other: '' }
    }))
  }

  function pickOther(qid: string): void {
    if (isSubmitted) return
    setAnswers((cur) => ({
      ...cur,
      [qid]: { optionIndex: null, other: cur[qid]?.other ?? '' }
    }))
  }

  function setOtherText(qid: string, text: string): void {
    if (isSubmitted) return
    setAnswers((cur) => ({
      ...cur,
      [qid]: { optionIndex: null, other: text }
    }))
  }

  function submit(): void {
    if (!ready || isSubmitted) return
    onSubmit(card.cardId, answers)
  }

  return (
    <div className={'card question-card' + (isSubmitted ? ' submitted' : '')}>
      <div className="card-title">A few quick questions</div>
      {card.questions.map((q, i) => {
        const a = answers[q.id]
        const isOther =
          a && a.optionIndex == null && (a.other != null || a.other === '')
        return (
          <div key={q.id} className="question">
            <div className="question-text">
              <span className="question-num">{i + 1}.</span>
              {q.text}
            </div>
            <div className="question-options">
              {q.options.map((opt, idx) => (
                <button
                  key={opt}
                  className={
                    'q-option' + (a?.optionIndex === idx ? ' active' : '')
                  }
                  onClick={() => pick(q.id, idx)}
                  disabled={isSubmitted}
                >
                  {opt}
                </button>
              ))}
              <button
                className={'q-option' + (isOther ? ' active' : '')}
                onClick={() => pickOther(q.id)}
                disabled={isSubmitted}
              >
                Other…
              </button>
            </div>
            {isOther && (
              <input
                className="q-other-input"
                placeholder="Type your answer"
                value={a?.other ?? ''}
                onChange={(e) => setOtherText(q.id, e.target.value)}
                disabled={isSubmitted}
              />
            )}
          </div>
        )
      })}
      <div className="card-footer">
        <button
          className="primary-btn small"
          onClick={submit}
          disabled={!ready || isSubmitted}
        >
          {isSubmitted ? 'Submitted' : 'Submit answers'}
        </button>
      </div>
    </div>
  )
}

export function formatAnswers(
  card: QuestionCardData,
  answers: Record<string, QuestionAnswer>
): string {
  const lines: string[] = ['Here are my answers:']
  card.questions.forEach((q, i) => {
    const a = answers[q.id]
    let val = '(no answer)'
    if (a) {
      if (a.optionIndex != null) val = q.options[a.optionIndex] ?? '(invalid)'
      else if (a.other && a.other.trim()) val = `Other: ${a.other.trim()}`
    }
    lines.push(`**Q${i + 1}** — ${q.text}\n→ ${val}`)
  })
  return lines.join('\n\n')
}
