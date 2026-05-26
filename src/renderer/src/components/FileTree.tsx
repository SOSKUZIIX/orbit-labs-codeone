import { useEffect, useRef, useState } from 'react'
import type { FileNode } from '@shared/types'
import {
  ChevronDown,
  ChevronRight,
  CloseIcon,
  FileGenericIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageFileIcon,
  MoreVerticalIcon
} from './Icons'

const IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'svg',
  'avif'
])
function isImage(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.has(ext)
}

interface Props {
  root: FileNode | null
  onOpenFile: (path: string) => void
  onOpenFolder: () => void
  onCloseFolder: () => void
  onClose: () => void
  rootPath: string | null
  activePath: string | null
}

export function FileTree({
  root,
  onOpenFile,
  onOpenFolder,
  onCloseFolder,
  onClose,
  rootPath,
  activePath
}: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    node: FileNode
  } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen && !contextMenu) return
    function onDocClick(e: MouseEvent): void {
      if (
        wrapRef.current &&
        e.target instanceof Node &&
        !wrapRef.current.contains(e.target)
      ) {
        setMenuOpen(false)
      }
      setContextMenu(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen, contextMenu])

  async function copyText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text)
    setContextMenu(null)
  }

  function relativePath(path: string): string {
    if (!rootPath || !path.startsWith(rootPath)) return path
    return path.slice(rootPath.length).replace(/^[/\\]/, '')
  }

  return (
    <div className="filetree">
      <div className="panel-header">
        <span className="panel-title">EXPLORER</span>
        <div className="header-actions">
          <div className="folder-menu-wrap" ref={wrapRef}>
            <button
              className={'ghost-icon' + (menuOpen ? ' active' : '')}
              onClick={() => setMenuOpen((v) => !v)}
              title="Folder actions"
              aria-label="Folder actions"
              disabled={!root}
            >
              <MoreVerticalIcon size={16} />
            </button>
            {menuOpen && (
              <div className="folder-menu">
                <button
                  className="folder-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenFolder()
                  }}
                >
                  Open Workspace…
                </button>
                <button
                  className="folder-menu-item danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onCloseFolder()
                  }}
                  disabled={!root}
                >
                  Close Workspace
                </button>
              </div>
            )}
          </div>
          <button
            className="ghost-icon close-x"
            onClick={onClose}
            title="Hide explorer"
            aria-label="Hide explorer"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
      {!root ? (
        <div className="filetree-empty">
          <p>You have not yet opened a workspace.</p>
          <button className="welcome-primary small" onClick={onOpenFolder}>
            Open Workspace
          </button>
        </div>
      ) : (
        <>
          <div className="root-label" title={rootPath ?? root.path}>
            {root.name.toUpperCase()}
          </div>
          <div className="tree-scroll">
            {root.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={0}
                onOpenFile={onOpenFile}
                activePath={activePath}
                onContextMenu={(node, e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, node })
                }}
              />
            ))}
          </div>
          {contextMenu && (
            <div
              className="tree-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button onClick={() => void copyText(contextMenu.node.path)}>
                Copy Path
              </button>
              <button
                onClick={() => void copyText(relativePath(contextMenu.node.path))}
              >
                Copy Relative Path
              </button>
              <button
                onClick={() => {
                  setContextMenu(null)
                  if (!contextMenu.node.isDirectory) onOpenFile(contextMenu.node.path)
                }}
                disabled={contextMenu.node.isDirectory}
              >
                Open File
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  onOpenFile,
  activePath,
  onContextMenu
}: {
  node: FileNode
  depth: number
  onOpenFile: (p: string) => void
  activePath: string | null
  onContextMenu: (node: FileNode, e: React.MouseEvent) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[] | null>(
    node.children ?? null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (node.children !== undefined) setChildren(node.children)
  }, [node.children])

  async function toggle(): Promise<void> {
    if (!node.isDirectory) {
      onOpenFile(node.path)
      return
    }
    if (!expanded && children == null) {
      setLoading(true)
      try {
        const fresh = await window.orbit.fs.readDir(node.path)
        setChildren(fresh.children ?? [])
      } finally {
        setLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  const indent = 8 + depth * 12
  const isActive = !node.isDirectory && activePath === node.path

  return (
    <>
      <button
        className={'tree-row' + (isActive ? ' active' : '')}
        style={{ paddingLeft: indent }}
        onClick={toggle}
        onContextMenu={(e) => onContextMenu(node, e)}
        title={node.path}
      >
        <span className="tree-chevron">
          {node.isDirectory ? (
            expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <span style={{ display: 'inline-block', width: 12 }} />
          )}
        </span>
        <span className="tree-icon">
          {node.isDirectory ? (
            expanded ? (
              <FolderOpenIcon size={14} />
            ) : (
              <FolderIcon size={14} />
            )
          ) : isImage(node.name) ? (
            <ImageFileIcon size={14} />
          ) : (
            <FileGenericIcon size={14} />
          )}
        </span>
        <span className="tree-name">{node.name}</span>
      </button>
      {expanded && node.isDirectory && (
        <>
          {loading && (
            <div className="tree-loading" style={{ paddingLeft: indent + 30 }}>
              loading…
            </div>
          )}
          {children?.map((c) => (
            <TreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              activePath={activePath}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
    </>
  )
}
