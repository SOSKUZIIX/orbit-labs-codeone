import { Fragment, type ReactNode } from 'react'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index))
    if (match[2]) out.push(<strong key={key++}>{match[2]}</strong>)
    else if (match[4]) out.push(<code key={key++}>{match[4]}</code>)
    else if (match[6]) out.push(<em key={key++}>{match[6]}</em>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex))
  return out
}

export function Markdown({ source }: { source: string }): ReactNode {
  const parts: ReactNode[] = []
  const codeFence = /```([\w-]*)\n([\s\S]*?)(?:```|$)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = codeFence.exec(source))) {
    if (m.index > lastIndex) {
      const before = source.slice(lastIndex, m.index)
      parts.push(<TextBlock key={key++} text={before} />)
    }
    parts.push(
      <pre key={key++}>
        <code>{m[2]}</code>
      </pre>
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < source.length) {
    parts.push(<TextBlock key={key++} text={source.slice(lastIndex)} />)
  }
  // Avoid unused warnings for escapeHtml; kept for future use.
  void escapeHtml
  return <>{parts}</>
}

function TextBlock({ text }: { text: string }): ReactNode {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {renderInline(line)}
          {i < lines.length - 1 ? '\n' : null}
        </Fragment>
      ))}
    </>
  )
}
