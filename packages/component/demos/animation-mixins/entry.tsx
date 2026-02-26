import { createRoot, type Handle, type RemixNode } from 'remix/component'
import { EnterAnimation } from './enter.tsx'
import { ExitAnimation } from './exit.tsx'
import { MultiStateBadge } from './multi-state-badge.tsx'

function Tile(handle: Handle) {
  let remountKey = 0

  return ({ title, children, notes }: { title: string; children: RemixNode; notes?: string }) => (
    <div
      css={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: 12,
        boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
      }}
    >
      <button
        css={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          width: 18,
          height: 18,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          opacity: 0.4,
          '&:hover': {
            opacity: 1,
          },
        }}
        on={{
          click() {
            remountKey++
            handle.update()
          },
        }}
        title="Replay animation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
        </svg>
      </button>
      <h3 css={{ margin: 0 }}>{title}</h3>
      <div
        key={remountKey}
        css={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 280,
        }}
      >
        {children}
      </div>
      {notes && (
        <p
          css={{
            margin: 0,
            fontSize: 12,
            color: '#666',
            textAlign: 'center',
            maxWidth: '200px',
          }}
        >
          {notes}
        </p>
      )}
    </div>
  )
}

createRoot(document.body).render(
  <>
    <h1 css={{ marginBottom: 0, '& + p': { marginTop: 0 } }}>Animation Mixins</h1>
    <p>Mixin-native enter/exit animation demos.</p>
    <div
      css={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 24,
        marginTop: 40,
      }}
    >
      <Tile title="Enter Animation" notes="animateEntrance() with spring physics">
        <EnterAnimation />
      </Tile>
      <Tile title="Exit Animation" notes="animateEntrance() + animateExit()">
        <ExitAnimation />
      </Tile>
      <Tile title="Multi-State Badge" notes="Animated icon/label swap with WAAPI shake">
        <MultiStateBadge />
      </Tile>
    </div>
  </>,
)
