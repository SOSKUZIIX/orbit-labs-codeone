import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

if (!window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'json') return new JsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less')
        return new CssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor')
        return new HtmlWorker()
      if (label === 'typescript' || label === 'javascript') return new TsWorker()
      return new EditorWorker()
    }
  }
}

const ORBIT_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#181818',
    'editor.foreground': '#e5e5e5',
    'editorLineNumber.foreground': '#4a4a4a',
    'editorLineNumber.activeForeground': '#a0a0a0',
    'editor.selectionBackground': '#2a3a5a',
    'editor.lineHighlightBackground': '#1f1f1f',
    'editor.lineHighlightBorder': '#1f1f1f00',
    'editorCursor.foreground': '#e5e5e5',
    'editorIndentGuide.background': '#262626',
    'editorIndentGuide.activeBackground': '#3a3a3a',
    'editorWidget.background': '#1a1a1a',
    'editorWidget.border': 'rgba(255,255,255,0.06)',
    'editorGutter.background': '#181818',
    'editorBracketMatch.background': '#2a2a2a',
    'editorBracketMatch.border': '#3a3a3a',
    'scrollbarSlider.background': '#ffffff10',
    'scrollbarSlider.hoverBackground': '#ffffff20',
    'scrollbarSlider.activeBackground': '#ffffff30'
  }
}

let themeRegistered = false
export function ensureTheme(): void {
  if (themeRegistered) return
  monaco.editor.defineTheme('orbit-dark', ORBIT_THEME)
  themeRegistered = true
}

export { monaco }
