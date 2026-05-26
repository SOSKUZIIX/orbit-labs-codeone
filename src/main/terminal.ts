import { BrowserWindow } from 'electron'
import { spawn as spawnChild, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { spawn as spawnPty, type IPty } from 'node-pty'
import { homedir } from 'node:os'
import { IPC } from '@shared/ipc'
import type { TerminalChunk } from '@shared/types'

type TerminalProcess = IPty | ChildProcessWithoutNullStreams

interface Session {
  id: string
  proc: TerminalProcess
  cwd: string
}

const sessions = new Map<string, Session>()

function emit(window: BrowserWindow, chunk: TerminalChunk): void {
  if (window.isDestroyed()) return
  window.webContents.send(IPC.TerminalEvent, chunk)
}

function shellInfo(): { cmd: string; args: string[] } {
  if (process.platform === 'win32') {
    return { cmd: process.env.COMSPEC || 'powershell.exe', args: [] }
  }
  return { cmd: process.env.SHELL || '/bin/zsh', args: ['-l'] }
}

function spawnPipeTerminal(
  shell: { cmd: string; args: string[] },
  cwd: string,
  window: BrowserWindow,
  id: string
): ChildProcessWithoutNullStreams {
  const proc = spawnChild(shell.cmd, shell.args, {
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  proc.stdout.on('data', (b: Buffer) =>
    emit(window, { sessionId: id, data: b.toString('utf8') })
  )
  proc.stderr.on('data', (b: Buffer) =>
    emit(window, { sessionId: id, data: b.toString('utf8') })
  )
  proc.on('exit', (code) => {
    emit(window, { sessionId: id, data: '', exit: code ?? 0 })
    sessions.delete(id)
  })
  proc.on('error', (err) => {
    emit(window, {
      sessionId: id,
      data: `\r\n[shell error] ${err.message}\r\n`,
      exit: 1
    })
    sessions.delete(id)
  })
  return proc
}

export function startTerminal(
  window: BrowserWindow,
  id: string,
  cwd: string | null,
  cols = 100,
  rows = 30
): void {
  if (sessions.has(id)) return
  const { cmd, args } = shellInfo()
  const startCwd = cwd || homedir()
  let proc: TerminalProcess
  try {
    proc = spawnPty(cmd, args, {
      name: 'xterm-256color',
      cols: Math.max(20, cols),
      rows: Math.max(5, rows),
      cwd: startCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '1'
      }
    })
    proc.onData((data) => emit(window, { sessionId: id, data }))
    proc.onExit(({ exitCode }) => {
      emit(window, { sessionId: id, data: '', exit: exitCode })
      sessions.delete(id)
    })
    emit(window, { sessionId: id, data: '', mode: 'pty' })
  } catch {
    proc = spawnPipeTerminal({ cmd, args }, startCwd, window, id)
    emit(window, {
      sessionId: id,
      data: `Compatibility terminal started in ${startCwd}\r\n$ `,
      mode: 'pipe'
    })
  }
  sessions.set(id, { id, proc, cwd: startCwd })
}

export function writeTerminal(id: string, data: string): void {
  const s = sessions.get(id)
  if (!s) return
  if ('write' in s.proc) {
    s.proc.write(data)
  } else {
    s.proc.stdin.write(data)
  }
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const s = sessions.get(id)
  if (!s) return
  if ('resize' in s.proc) {
    s.proc.resize(Math.max(20, cols), Math.max(5, rows))
  }
}

export function killTerminal(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  try {
    s.proc.kill()
  } catch {
    /* ignore */
  }
  sessions.delete(id)
}

export function killAllTerminals(): void {
  for (const id of [...sessions.keys()]) killTerminal(id)
}
