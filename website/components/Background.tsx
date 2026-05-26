/**
 * Global decorative background. Positioned `fixed` so it stays behind every
 * section as the user scrolls. All children are non-interactive.
 */
export function Background(): JSX.Element {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Aurora — slow drifting blobs near the top */}
      <div className="aurora" />

      {/* Two faint orbit rings far off to the right */}
      <div
        className="orbit-ring orbit-spin-slow"
        style={{
          width: '1100px',
          height: '1100px',
          top: '60vh',
          right: '-450px'
        }}
      >
        <span className="satellite" style={{ background: 'rgba(255,255,255,0.7)' }} />
      </div>
      <div
        className="orbit-ring orbit-spin-rev"
        style={{
          width: '780px',
          height: '780px',
          top: '70vh',
          right: '-300px'
        }}
      >
        <span
          className="satellite"
          style={{
            background: 'rgba(180,200,255,0.7)',
            boxShadow: '0 0 14px rgba(180,200,255,0.5)'
          }}
        />
      </div>

      {/* Occasional twinkle streaks */}
      <span className="streak" style={{ left: '12%', animationDelay: '0s' }} />
      <span className="streak" style={{ left: '34%', animationDelay: '2.5s' }} />
      <span className="streak" style={{ left: '67%', animationDelay: '4.2s' }} />
      <span className="streak" style={{ left: '88%', animationDelay: '5.8s' }} />

      {/* Soft film-grain overlay sits on top of everything else here */}
      <div className="noise" />
    </div>
  )
}
