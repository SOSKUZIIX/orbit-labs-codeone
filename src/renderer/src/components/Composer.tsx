import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  busy: boolean
  disabled?: boolean
  placeholder?: string
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  disabled,
  placeholder
}: Props): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [value])

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      if (!busy && value.trim()) onSubmit()
    }
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder={placeholder ?? 'Ask anything…  (Shift+Enter for newline)'}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
        />
        {busy ? (
          <button className="cancel-btn send-btn" onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
          >
            Send
          </button>
        )}
      </div>
      <div className="composer-hint">
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  )
}
