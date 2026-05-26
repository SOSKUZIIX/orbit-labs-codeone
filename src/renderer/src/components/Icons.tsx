interface IconProps {
  size?: number
  className?: string
}

const base = (size = 16): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
})

export function FilesIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 4a1 1 0 0 1 1-1h7l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M13 3v5h5" />
    </svg>
  )
}

export function SearchIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function DebugIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="13" r="4.5" />
      <path d="M12 8.5V6m-3 4-2-1m8 1 2-1M9 16l-2 1m8-1 2 1M9.5 11.5h5M9.5 14.5h5" />
    </svg>
  )
}

export function SettingsIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2m0 12v2M4 12h2m12 0h2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4M6.3 17.7l1.4-1.4m8.6-8.6 1.4-1.4" />
    </svg>
  )
}

export function ChatIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 4v-4H7a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function PlusIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
  )
}

export function ChevronRight({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function ChevronDown({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function FolderIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function MoreVerticalIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FolderOpenIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v1H4z" />
      <path d="M4 10h16l-1.5 7a1 1 0 0 1-1 .8H6.5a1 1 0 0 1-1-.8z" />
    </svg>
  )
}

export function FileGenericIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 4a1 1 0 0 1 1-1h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
      <path d="M14 3v5h4" />
    </svg>
  )
}

export function HistoryIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

export function ImageFileIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 16 4-4 4 4 3-3 5 5" />
    </svg>
  )
}

export function TerminalIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m7 10 3 2-3 2" />
      <path d="M13 14h4" />
    </svg>
  )
}

export function BrowserIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.7 5.4 3.7 8.5s-1.3 6-3.7 8.5M12 3.5c-2.4 2.5-3.7 5.4-3.7 8.5s1.3 6 3.7 8.5" />
    </svg>
  )
}

export function PreviewIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3.5" y="5" width="17" height="13" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </svg>
  )
}

export function PlanIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 10h8M8 13h8M8 16h5" />
    </svg>
  )
}

export function SparkleIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 4 13.5 9 18 10.5 13.5 12 12 17 10.5 12 6 10.5 10.5 9z" />
      <path d="M19 15.5 19.7 17.5 21.5 18 19.7 18.5 19 20.5 18.3 18.5 16.5 18 18.3 17.5z" />
    </svg>
  )
}

export function SendIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="m4 12 16-8-4 16-4-7z" />
      <path d="m12 13 4-9" />
    </svg>
  )
}

export function StopIcon({ size, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  )
}

import logoUrl from '../assets/logo.png'

export function OrbitLogo({ size = 28, className }: IconProps): JSX.Element {
  return (
    <img
      src={logoUrl}
      width={size}
      alt="CodeOne"
      draggable={false}
      className={'orbit-logo' + (className ? ' ' + className : '')}
    />
  )
}
