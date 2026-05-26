import { useEffect, useState } from 'react'
import { basename } from '../lib/path'

interface Props {
  path: string
  content: string // data URL or raw SVG markup
  mimeType: string
}

export function ImagePreview({ path, content, mimeType }: Props): JSX.Element {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const isSvg = mimeType === 'image/svg+xml' && !content.startsWith('data:')
  const src = isSvg
    ? `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
    : content

  useEffect(() => {
    setDims(null)
    setZoom(1)
  }, [path])

  return (
    <div className="image-preview">
      <div className="image-preview-toolbar">
        <span className="image-preview-name">{basename(path)}</span>
        <span className="image-preview-meta">
          {dims ? `${dims.w} × ${dims.h}` : '…'} · {mimeType}
        </span>
        <span className="image-preview-spacer" />
        <button
          className="ghost-btn"
          onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
        >
          −
        </button>
        <span className="image-preview-zoom">{Math.round(zoom * 100)}%</span>
        <button
          className="ghost-btn"
          onClick={() => setZoom((z) => Math.min(8, z + 0.25))}
        >
          +
        </button>
        <button className="ghost-btn" onClick={() => setZoom(1)}>
          Reset
        </button>
      </div>
      <div className="image-preview-canvas">
        <img
          src={src}
          alt={basename(path)}
          style={{ transform: `scale(${zoom})` }}
          onLoad={(e) => {
            const img = e.currentTarget
            setDims({ w: img.naturalWidth, h: img.naturalHeight })
          }}
        />
      </div>
    </div>
  )
}
