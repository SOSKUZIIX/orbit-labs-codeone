import { useEffect, useRef, useState } from 'react'
import type { AgentMode, ProviderId } from '@shared/types'
import { PROVIDERS } from '@shared/providers'
import { ChevronDown, SendIcon, StopIcon } from './Icons'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: (textOverride?: string) => void
  onCancel: () => void
  busy: boolean
  queuedCount: number
  provider: ProviderId
  model: string
  mode: AgentMode
  rootPath: string | null
  onModelSelect: (provider: ProviderId, model: string) => void
  onModeChange: (m: AgentMode) => void
  placeholder?: string
}

interface ImageAttachment {
  name: string
  path: string
  mimeType: string
  previewUrl: string
}

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  queuedCount,
  provider,
  model,
  mode,
  rootPath,
  onModelSelect,
  onModeChange,
  placeholder
}: Props): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [modelOpen, setModelOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const activeProvider = PROVIDERS.find((p) => p.id === provider)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [value])

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit(): void {
    const trimmed = value.trim()
    if (!trimmed && attachments.length === 0) return
    const attachmentText =
      attachments.length === 0
        ? ''
        : `\n\nAttached images saved in the workspace for use in code:\n${attachments
            .map((a) => `- ${a.name}: ${a.path}`)
            .join('\n')}\n\nUse these image file paths directly when editing or generating code.`
    setAttachments([])
    setAttachmentError(null)
    onSubmit((trimmed || 'Use the attached image assets.') + attachmentText)
  }

  async function importImages(files: FileList | File[]): Promise<void> {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    if (!rootPath) {
      setAttachmentError('Open a workspace before attaching images.')
      return
    }
    setAttachmentError(null)
    const next: ImageAttachment[] = []
    for (const file of imageFiles) {
      const dataUrl = await readFileAsDataUrl(file)
      const imported = await window.orbit.fs.importAttachment(
        rootPath,
        file.name || 'image',
        dataUrl
      )
      next.push({ ...imported, previewUrl: dataUrl })
    }
    setAttachments((cur) => [...cur, ...next])
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>): void {
    const files = e.clipboardData.files
    if (files.length > 0) {
      e.preventDefault()
      void importImages(files)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragging(false)
    void importImages(e.dataTransfer.files)
  }

  function removeAttachment(path: string): void {
    setAttachments((cur) => cur.filter((a) => a.path !== path))
  }

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (!pickerRef.current?.contains(e.target as Node)) setModelOpen(false)
    }
    if (!modelOpen) return
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [modelOpen])

  return (
    <div
      className={'agent-composer' + (dragging ? ' dragging' : '')}
      data-tour="composer"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void importImages(e.target.files)
          e.currentTarget.value = ''
        }}
      />
      <textarea
        ref={ref}
        rows={3}
        value={value}
        placeholder={placeholder ?? 'Ask anything…'}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        onKeyDown={onKey}
      />
      {(attachments.length > 0 || attachmentError) && (
        <div className="attachment-strip">
          {attachments.map((a) => (
            <button
              key={a.path}
              className="attachment-chip"
              title={a.path}
              onClick={() => removeAttachment(a.path)}
            >
              <img src={a.previewUrl} alt="" />
              <span>{a.name}</span>
            </button>
          ))}
          {attachmentError && (
            <span className="attachment-error">{attachmentError}</span>
          )}
        </div>
      )}
      <div className="agent-composer-toolbar">
        <button
          className={'mode-btn' + (mode === 'agent' ? ' active' : '')}
          onClick={() => onModeChange(mode === 'agent' ? 'plan' : 'agent')}
          title={mode === 'agent' ? 'Switch to Plan' : 'Switch to Agent'}
        >
          {mode === 'agent' ? 'Agent' : 'Plan'}
        </button>
        <div className="model-picker-wrap" ref={pickerRef}>
          <button
            className="model-picker-trigger"
            onClick={() => setModelOpen((v) => !v)}
            title="Model"
          >
            <span className="model-provider-dot">{activeProvider?.label ?? provider}</span>
            <span className="model-picker-name">{model}</span>
            <ChevronDown size={12} />
          </button>
          {modelOpen && (
            <div className="model-picker-menu">
              {PROVIDERS.map((p) => (
                <div className="model-picker-group" key={p.id}>
                  <div className="model-picker-group-title">{p.label}</div>
                  {p.models.map((id) => (
                    <button
                      key={id}
                      className={'model-picker-item' + (id === model ? ' active' : '')}
                      onClick={() => {
                        onModelSelect(p.id, id)
                        setModelOpen(false)
                      }}
                    >
                      <span>{id}</span>
                      {id === model && <span className="model-active-mark">Selected</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="mode-btn"
          onClick={() => fileRef.current?.click()}
          title="Attach image"
        >
          Image
        </button>
        <span className="composer-spacer" />
        {queuedCount > 0 && (
          <span className="queued-pill">
            {queuedCount} queued
          </span>
        )}
        <button
          className="composer-action send"
          onClick={submit}
          disabled={!value.trim() && attachments.length === 0}
          title={busy ? 'Queue message' : 'Send (Enter)'}
        >
          <SendIcon size={14} />
        </button>
        {busy && (
          <button className="composer-action stop" onClick={onCancel} title="Stop">
            <StopIcon size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}
