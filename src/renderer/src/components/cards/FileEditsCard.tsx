import type { UICard } from '@shared/types'
import { FileGenericIcon } from '../Icons'
import { basename } from '../../lib/path'

type FileEditsCardData = Extract<UICard, { type: 'file-edits' }>

interface Props {
  card: FileEditsCardData
  onOpenFile: (path: string) => void
}

const ACTION_LABEL: Record<'created' | 'modified' | 'deleted', string> = {
  created: '+ created',
  modified: '~ modified',
  deleted: '− deleted'
}

export function FileEditsCard({ card, onOpenFile }: Props): JSX.Element {
  const counts = card.edits.reduce(
    (acc, e) => {
      acc[e.action] = (acc[e.action] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const summary = (['created', 'modified', 'deleted'] as const)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${k}`)
    .join(' · ')

  return (
    <div className="card file-edits-card">
      <div className="card-title">
        {card.edits.length} file{card.edits.length === 1 ? '' : 's'} edited
      </div>
      {summary && <div className="card-subtitle">{summary}</div>}
      <ul className="edits-list">
        {card.edits.map((e) => (
          <li key={e.path} className={'edit-item action-' + e.action}>
            <span className="edit-action">{ACTION_LABEL[e.action]}</span>
            <button
              className="edit-name"
              onClick={() => onOpenFile(e.path)}
              title={e.path}
            >
              <FileGenericIcon size={12} />
              <span>{basename(e.path)}</span>
            </button>
            <span className="edit-dir">{dirOf(e.path)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (idx < 0) return ''
  // show last 2 segments to keep compact
  const dir = path.slice(0, idx)
  const parts = dir.split(/[\\/]/).filter(Boolean)
  return '…/' + parts.slice(-2).join('/')
}
