import { useEffect, useMemo, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { CloseIcon, PlusIcon, TerminalIcon } from './Icons'

interface Props {
  cwd: string | null
  onClose: () => void
}

const SESSION = 'main'

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function measure(el: HTMLElement): { cols: number; rows: number } {
  const probe = document.createElement('span')
  probe.textContent = 'W'
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.fontFamily = 'var(--font-mono)'
  probe.style.fontSize = '12px'
  el.appendChild(probe)
  const rect = probe.getBoundingClientRect()
  probe.remove()
  const cellWidth = Math.max(7, rect.width)
  const cellHeight = Math.max(16, rect.height * 1.35)
  const bounds = el.getBoundingClientRect()
  return {
    cols: Math.max(20, Math.floor((bounds.width - 18) / cellWidth)),
    rows: Math.max(5, Math.floor((bounds.height - 16) / cellHeight))
  }
}

export function Terminal({ cwd, onClose }: Props): JSX.Element {
  const sessionId = useMemo(() => `${SESSION}-${uid()}`, [])
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const pipeModeRef = useRef(false)
  const pipeInputRef = useRef('')
  const cwdRef = useRef<string | null>(cwd)
  cwdRef.current = cwd

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        'SF Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      theme: {
        background: '#0c0e10',
        foreground: '#edf2f5',
        cursor: '#ffffff',
        selectionBackground: '#3a3f45',
        black: '#000000',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#d4d4d4',
        blue: '#aeb8c2',
        magenta: '#c7c7c7',
        cyan: '#edf2f5',
        white: '#ffffff',
        brightBlack: '#56616b',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#f5f5f5',
        brightBlue: '#d1d5db',
        brightMagenta: '#e5e7eb',
        brightCyan: '#ffffff',
        brightWhite: '#ffffff'
      }
    })
    term.open(host)
    termRef.current = term
    term.focus()

    const onData = term.onData((data) => {
      if (pipeModeRef.current) {
        echoPipeInput(term, data, pipeInputRef)
      }
      void window.orbit.terminal.write(sessionId, data)
    })
    const off = window.orbit.terminal.onEvent((chunk) => {
      if (chunk.sessionId !== sessionId) return
      if (chunk.mode) pipeModeRef.current = chunk.mode === 'pipe'
      if (chunk.data) term.write(chunk.data)
      if (chunk.exit !== undefined) {
        term.write(`\r\n[process exited with code ${chunk.exit}]\r\n`)
      }
    })

    function fit(): void {
      if (!hostRef.current || !termRef.current) return
      const { cols, rows } = measure(hostRef.current)
      termRef.current.resize(cols, rows)
      void window.orbit.terminal.resize(sessionId, cols, rows)
    }

    const ro = new ResizeObserver(fit)
    ro.observe(host)
    requestAnimationFrame(fit)

    return () => {
      ro.disconnect()
      onData.dispose()
      off()
      term.dispose()
      termRef.current = null
    }
  }, [sessionId])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    const { cols, rows } = hostRef.current
      ? measure(hostRef.current)
      : { cols: 100, rows: 30 }
    term.reset()
    pipeModeRef.current = false
    pipeInputRef.current = ''
    void window.orbit.terminal.start(sessionId, cwd, cols, rows)
    term.focus()
    return () => {
      void window.orbit.terminal.kill(sessionId)
    }
  }, [cwd, sessionId])

  function focusTerminal(): void {
    termRef.current?.focus()
  }

  function clear(): void {
    termRef.current?.clear()
    termRef.current?.focus()
  }

  return (
    <div className="terminal">
      <div className="panel-header">
        <span className="panel-title">
          <TerminalIcon size={12} /> &nbsp;TERMINAL
        </span>
        <div className="header-actions">
          <button className="ghost-icon" onClick={clear} title="Clear">
            <PlusIcon size={16} />
          </button>
          <button
            className="ghost-icon close-x"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
      <div
        className="terminal-output"
        ref={hostRef}
        onMouseDown={focusTerminal}
        onClick={focusTerminal}
      />
    </div>
  )
}

function echoPipeInput(
  term: XTerm,
  data: string,
  inputRef: React.MutableRefObject<string>
): void {
  for (const ch of data) {
    if (ch === '\r') {
      term.write('\r\n')
      inputRef.current = ''
    } else if (ch === '\u007f') {
      if (inputRef.current.length > 0) {
        inputRef.current = inputRef.current.slice(0, -1)
        term.write('\b \b')
      }
    } else if (ch === '\u0003') {
      term.write('^C\r\n$ ')
      inputRef.current = ''
    } else if (ch >= ' ') {
      inputRef.current += ch
      term.write(ch)
    }
  }
}
