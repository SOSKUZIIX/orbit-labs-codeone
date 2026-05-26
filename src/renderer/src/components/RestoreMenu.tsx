import { useEffect, useRef, useState } from 'react'
import type { FileSnapshot } from '@shared/types'
import { HistoryIcon } from './Icons'

interface Props {
  activePath: string | null
  onRestore: (path: string, content: string) => void
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function RestoreMenu({ activePath, onRestore }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [snaps, setSnaps] = useState<FileSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent): void {
      if (
        wrapRef.current &&
        e.target instanceof Node &&
        !wrapRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function load(): Promise<void> {
    if (!activePath) return
    setLoading(true)
    try {
      const list = await window.orbit.snapshots.list(activePath)
      setSnaps(list)
    } finally {
      setLoading(false)
    }
  }

  function toggle(): void {
    setOpen((v) => {
      const next = !v
      if (next) void load()
      return next
    })
  }

  async function handleRestore(snap: FileSnapshot): Promise<void> {
    if (!activePath) return
    const restored = await window.orbit.snapshots.restore(
      activePath,
      snap.createdAt
    )
    if (restored) onRestore(activePath, restored.content)
    setOpen(false)
  }

  return (
    <div className="restore-wrap" ref={wrapRef}>
      <button
        className={'ghost-icon' + (open ? ' active' : '')}
        onClick={toggle}
        disabled={!activePath}
        title="Restore previous version"
      >
        <HistoryIcon size={14} />
      </button>
      {open && (
        <div className="restore-menu">
          <div className="restore-menu-header">Restore previous version</div>
          {loading ? (
            <div className="restore-empty">Loading…</div>
          ) : snaps.length === 0 ? (
            <div className="restore-empty">
              No snapshots yet. They are created when you save or reopen the file.
            </div>
          ) : (
            <div className="restore-list">
              {snaps.map((s) => (
                <button
                  key={s.createdAt}
                  className="restore-item"
                  onClick={() => handleRestore(s)}
                >
                  <span className="restore-time">{formatTime(s.createdAt)}</span>
                  <span className="restore-rel">{formatRelative(s.createdAt)}</span>
                  <span className="restore-label">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
