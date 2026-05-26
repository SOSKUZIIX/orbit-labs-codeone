import type { UICard } from '@shared/types'

type PermissionCardData = Extract<UICard, { type: 'permission' }>

interface Props {
  card: PermissionCardData
  onDecide: (
    cardId: string,
    decision: 'denied' | 'allowed' | 'always'
  ) => void
}

export function PermissionCard({ card, onDecide }: Props): JSX.Element {
  const isPending = card.status === 'pending'
  return (
    <div className={'card permission-card status-' + card.status}>
      <div className="card-title">{card.title}</div>
      <div className="card-body">{card.description}</div>
      <div className="card-footer">
        {!isPending ? (
          <span className="card-status">
            {card.status === 'denied' && 'Denied'}
            {card.status === 'allowed' && 'Allowed once'}
            {card.status === 'always' && 'Always allowed'}
          </span>
        ) : (
          <>
            <button
              className="ghost-btn cancel-btn"
              onClick={() => onDecide(card.cardId, 'denied')}
            >
              No
            </button>
            <button
              className="ghost-btn"
              onClick={() => onDecide(card.cardId, 'allowed')}
            >
              Allow once
            </button>
            <button
              className="primary-btn small"
              onClick={() => onDecide(card.cardId, 'always')}
            >
              Always allow
            </button>
          </>
        )}
      </div>
    </div>
  )
}
