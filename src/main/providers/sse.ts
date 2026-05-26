export async function* readSSE(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      if (signal.aborted) break
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const lines = raw.split('\n')
        let event: string | undefined
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (dataLines.length) yield { event, data: dataLines.join('\n') }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* readJSONStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let depth = 0
  let inString = false
  let escape = false
  let start = -1
  try {
    while (true) {
      if (signal.aborted) break
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i]
        if (inString) {
          if (escape) escape = false
          else if (c === '\\') escape = true
          else if (c === '"') inString = false
          continue
        }
        if (c === '"') inString = true
        else if (c === '{') {
          if (depth === 0) start = i
          depth++
        } else if (c === '}') {
          depth--
          if (depth === 0 && start !== -1) {
            const chunk = buffer.slice(start, i + 1)
            try {
              yield JSON.parse(chunk)
            } catch {
              /* ignore parse errors */
            }
            buffer = buffer.slice(i + 1)
            i = -1
            start = -1
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
