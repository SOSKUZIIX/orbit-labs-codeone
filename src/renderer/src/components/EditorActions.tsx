import { BrowserIcon, PreviewIcon, TerminalIcon } from './Icons'
import { RestoreMenu } from './RestoreMenu'

interface Props {
  activePath: string | null
  onOpenInBrowser: () => void
  onTogglePreview: () => void
  onSetPreviewUrl: () => void
  onToggleTerminal: () => void
  previewOpen: boolean
  terminalOpen: boolean
  canOpenInBrowser: boolean
  canPreview: boolean
  onRestore: (path: string, content: string) => void
}

export function EditorActions({
  activePath,
  onOpenInBrowser,
  onTogglePreview,
  onSetPreviewUrl,
  onToggleTerminal,
  previewOpen,
  terminalOpen,
  canOpenInBrowser,
  canPreview,
  onRestore
}: Props): JSX.Element {
  return (
    <div className="editor-actions">
      <RestoreMenu activePath={activePath} onRestore={onRestore} />
      <button
        className="ghost-icon"
        onClick={onOpenInBrowser}
        disabled={!canOpenInBrowser}
        title="Open in browser"
      >
        <BrowserIcon size={14} />
      </button>
      <button
        className={'ghost-icon' + (previewOpen ? ' active' : '')}
        onClick={onTogglePreview}
        disabled={!canPreview}
        title={previewOpen ? 'Hide preview' : 'Open preview'}
      >
        <PreviewIcon size={14} />
      </button>
      <button
        className="ghost-btn"
        onClick={onSetPreviewUrl}
        title="Set localhost preview URL"
      >
        URL
      </button>
      <button
        className={'ghost-icon' + (terminalOpen ? ' active' : '')}
        onClick={onToggleTerminal}
        title={terminalOpen ? 'Hide terminal' : 'Open terminal'}
        data-tour="toggle-terminal"
      >
        <TerminalIcon size={14} />
      </button>
    </div>
  )
}
