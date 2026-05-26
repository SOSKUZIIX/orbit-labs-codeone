import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchHit } from '@shared/types'
import { CloseIcon, SearchIcon } from './Icons'
import { basename } from '../lib/path'

interface Props {
  rootPath: string | null
  onOpenFile: (path: string) => void
  onClose: () => void
}

export function SearchPanel({
  rootPath,
  onOpenFile,
  onClose
}: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastQueryRef = useRef<string>('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced live search
  useEffect(() => {
    if (!rootPath) return
    const q = query.trim()
    if (!q) {
      setHits([])
      setHasSearched(false)
      return
    }
    const t = setTimeout(async () => {
      lastQueryRef.current = q
      setLoading(true)
      try {
        const r = await window.orbit.search.files(rootPath, q, caseSensitive)
        if (lastQueryRef.current === q) {
          setHits(r)
          setHasSearched(true)
        }
      } finally {
        if (lastQueryRef.current === q) setLoading(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [query, caseSensitive, rootPath])

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>()
    for (const h of hits) {
      const arr = map.get(h.path) ?? []
      arr.push(h)
      map.set(h.path, arr)
    }
    return Array.from(map.entries())
  }, [hits])

  return (
    <div className="search-panel">
      <div className="panel-header">
        <span className="panel-title">SEARCH</span>
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
      <div className="search-controls">
        <div className="search-input-wrap">
          <SearchIcon size={12} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={rootPath ? 'Search in folder…' : 'Open a folder first'}
            disabled={!rootPath}
            spellCheck={false}
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => setQuery('')}
              title="Clear"
            >
              <CloseIcon size={11} />
            </button>
          )}
        </div>
        <label className="search-toggle">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <span>Aa</span>
        </label>
      </div>
      <div className="search-results">
        {!rootPath ? (
          <div className="search-empty">No folder open.</div>
        ) : !query.trim() ? (
          <div className="search-empty">Type to search across the workspace.</div>
        ) : loading && hits.length === 0 ? (
          <div className="search-empty">Searching…</div>
        ) : hasSearched && hits.length === 0 ? (
          <div className="search-empty">No matches.</div>
        ) : (
          grouped.map(([path, list]) => (
            <div key={path} className="search-group">
              <button
                className="search-file"
                onClick={() => onOpenFile(path)}
                title={path}
              >
                <span className="search-file-name">{basename(path)}</span>
                <span className="search-file-count">{list.length}</span>
              </button>
              {list.slice(0, 12).map((h, i) => (
                <button
                  key={i}
                  className="search-hit"
                  onClick={() => onOpenFile(h.path)}
                >
                  <span className="search-hit-line">{h.line}</span>
                  <span className="search-hit-preview">
                    {highlight(h.preview, query, caseSensitive)}
                  </span>
                </button>
              ))}
              {list.length > 12 && (
                <div className="search-more">… and {list.length - 12} more</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function highlight(
  text: string,
  query: string,
  caseSensitive: boolean
): JSX.Element[] {
  if (!query) return [<span key={0}>{text}</span>]
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const out: JSX.Element[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const idx = haystack.indexOf(needle, i)
    if (idx < 0) {
      out.push(<span key={key++}>{text.slice(i)}</span>)
      break
    }
    if (idx > i) out.push(<span key={key++}>{text.slice(i, idx)}</span>)
    out.push(
      <mark key={key++} className="search-match">
        {text.slice(idx, idx + query.length)}
      </mark>
    )
    i = idx + query.length
  }
  return out
}
