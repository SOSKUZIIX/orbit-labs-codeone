import { CloseIcon } from './Icons'

interface Props {
  title: string
  message: string
  onClose: () => void
}

export function PlaceholderPanel({
  title,
  message,
  onClose
}: Props): JSX.Element {
  return (
    <div className="placeholder-panel">
      <div className="panel-header">
        <span className="panel-title">{title.toUpperCase()}</span>
        <div className="header-actions">
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
      <div className="placeholder-body">
        <p>{message}</p>
        <p className="placeholder-hint">Coming soon.</p>
      </div>
    </div>
  )
}
