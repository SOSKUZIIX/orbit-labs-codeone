import { BrowserIcon, CloseIcon, DebugIcon, TerminalIcon } from './Icons'

interface Props {
  rootPath: string | null
  onClose: () => void
  onOpenTerminal: () => void
  onOpenPreview: () => void
}

const COMMANDS = ['npm run dev', 'npm test', 'npm run build']

export function RunDebugPanel({
  rootPath,
  onClose,
  onOpenTerminal,
  onOpenPreview
}: Props): JSX.Element {
  return (
    <div className="run-debug-panel">
      <div className="panel-header">
        <span className="panel-title">RUN & DEBUG</span>
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

      <div className="run-debug-body">
        <div className="run-status">
          <DebugIcon size={18} />
          <div>
            <strong>{rootPath ? 'Workspace ready' : 'No folder open'}</strong>
            <span>{rootPath ? rootPath : 'Open a project folder to run commands.'}</span>
          </div>
        </div>

        <div className="run-action-grid">
          <button className="run-action-card" onClick={onOpenTerminal} disabled={!rootPath}>
            <TerminalIcon size={16} />
            <span>Terminal</span>
          </button>
          <button className="run-action-card" onClick={onOpenPreview}>
            <BrowserIcon size={16} />
            <span>Preview</span>
          </button>
        </div>

        <div className="run-section">
          <div className="run-section-title">Common Tasks</div>
          {COMMANDS.map((cmd) => (
            <div className="run-command-row" key={cmd}>
              <code>{cmd}</code>
            </div>
          ))}
        </div>

        <div className="run-section">
          <div className="run-section-title">Deployment</div>
          <div className="run-note">
            Vercel-ready projects need a clean build script, documented environment
            variables, and a visible preview route before publishing.
          </div>
        </div>
      </div>
    </div>
  )
}
