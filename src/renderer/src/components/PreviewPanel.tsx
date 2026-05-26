import { basename } from '../lib/path'
import { BrowserIcon, CloseIcon } from './Icons'

interface Props {
  path: string
  src?: string
  srcDoc?: string
  onOpenInBrowser: () => void
  onClose: () => void
}

export function PreviewPanel({
  path,
  src,
  srcDoc,
  onOpenInBrowser,
  onClose
}: Props): JSX.Element {
  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <span className="preview-title">{basename(path)}</span>
        <span className="preview-url">{src ?? path}</span>
        <span className="preview-spacer" />
        <button
          className="ghost-icon"
          onClick={onOpenInBrowser}
          title="Open in browser"
        >
          <BrowserIcon size={14} />
        </button>
        <button className="ghost-icon close-x" onClick={onClose} title="Close">
          <CloseIcon size={16} />
        </button>
      </div>
      <iframe
        className="preview-frame"
        src={src}
        srcDoc={srcDoc}
        title={`Preview ${path}`}
        sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts"
      />
    </div>
  )
}
