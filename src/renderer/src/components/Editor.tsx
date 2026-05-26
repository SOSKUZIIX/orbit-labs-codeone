import { useEffect, useRef } from 'react'
import { ensureTheme, monaco } from '../lib/monaco-setup'

interface Props {
  path: string
  value: string
  language: string
  onChange: (next: string) => void
  readOnly?: boolean
}

export function Editor({
  path,
  value,
  language,
  onChange,
  readOnly
}: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<monaco.editor.ITextModel | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Mount the editor once.
  useEffect(() => {
    if (!hostRef.current) return
    ensureTheme()
    const editor = monaco.editor.create(hostRef.current, {
      value,
      language,
      theme: 'orbit-dark',
      automaticLayout: true,
      fontSize: 12,
      lineHeight: 1.55,
      letterSpacing: 0.1,
      fontFamily:
        '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      tabSize: 2,
      wordWrap: 'off',
      padding: { top: 12, bottom: 24 },
      readOnly: readOnly ?? false
    })
    editor.onDidChangeModelContent(() => {
      const v = editor.getValue()
      onChangeRef.current(v)
    })
    editorRef.current = editor
    const observer = new ResizeObserver(() => {
      editor.layout()
    })
    observer.observe(hostRef.current)
    requestAnimationFrame(() => editor.layout())
    return () => {
      observer.disconnect()
      editor.dispose()
      modelRef.current?.dispose()
      editorRef.current = null
      modelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switch model when the file changes.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const uri = monaco.Uri.file(path)
    let model = monaco.editor.getModel(uri)
    if (!model) {
      model = monaco.editor.createModel(value, language, uri)
    } else if (model.getValue() !== value) {
      model.setValue(value)
    }
    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language)
    }
    editor.setModel(model)
    modelRef.current = model
    requestAnimationFrame(() => editor.layout())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // Reflect outer value changes (e.g. file reload).
  useEffect(() => {
    const editor = editorRef.current
    const model = modelRef.current
    if (!editor || !model) return
    if (model.getValue() !== value) {
      const pos = editor.getPosition()
      model.setValue(value)
      if (pos) editor.setPosition(pos)
    }
  }, [value])

  return <div ref={hostRef} className="editor-host" />
}

export function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    yml: 'yaml',
    yaml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    php: 'php',
    toml: 'ini'
  }
  return map[ext] ?? 'plaintext'
}
