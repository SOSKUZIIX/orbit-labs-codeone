import type { UICard } from '@shared/types'
import { FileGenericIcon } from '../Icons'
import { basename } from '../../lib/path'

type PlanCardData = Extract<UICard, { type: 'plan' }>

interface Props {
  card: PlanCardData
  onCancel: (cardId: string) => void
  onProceed: (cardId: string) => void
  onOpenDoc: (path: string) => void
}

export function PlanCard({
  card,
  onCancel,
  onProceed,
  onOpenDoc
}: Props): JSX.Element {
  const isPending = card.status === 'pending'
  return (
    <div className={'card plan-card status-' + card.status}>
      <div className="card-title">{card.title}</div>
      {card.summary && <div className="card-subtitle">{card.summary}</div>}
      {card.docPath && (
        <button
          className="plan-link"
          onClick={() => onOpenDoc(card.docPath!)}
          title={card.docPath}
        >
          <FileGenericIcon size={14} />
          <span className="plan-link-name">{basename(card.docPath)}</span>
          <span className="plan-link-hint">Open in editor →</span>
        </button>
      )}
      <div className="card-footer plan-footer">
        {card.status === 'cancelled' && (
          <span className="card-status">Cancelled</span>
        )}
        {card.status === 'proceeded' && (
          <span className="card-status proceeded">Proceeded</span>
        )}
        {isPending && (
          <>
            <button
              className="ghost-btn cancel-btn"
              onClick={() => onCancel(card.cardId)}
            >
              Cancel
            </button>
            <button
              className="primary-btn small"
              onClick={() => onProceed(card.cardId)}
            >
              Proceed
            </button>
          </>
        )}
      </div>
    </div>
  )
}
