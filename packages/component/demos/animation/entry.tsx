import { createRoot, type Handle, type RemixNode } from 'remix/component'
import { DefaultAnimate } from './default-animate.tsx'
import { EnterAnimation } from './enter.tsx'
import { ExitAnimation } from './exit.tsx'
import { Press } from './press.tsx'
import { HTMLContent } from './html-content.tsx'
import { Keyframes } from './keyframes.tsx'
import { InterruptibleKeyframes } from './interruptible-keyframes.tsx'
import { RollingSquare } from './rolling-square.tsx'
import { Rotate } from './rotate.tsx'
import { TransitionOptions } from './transition-options.tsx'
import { Cube } from './cube.tsx'
import { SharedLayout } from './shared-layout.tsx'
import { AspectRatio } from './aspect-ratio.tsx'
import { BouncySwitch } from './bouncy-switch.tsx'
import { ColorInterpolation } from './color-interpolation.tsx'
import { FlipToggle } from './flip-toggle.tsx'
import { Reordering } from './reordering.tsx'
import { MultiStateBadge } from './multi-state-badge.tsx'
import { HoldToConfirm } from './hold-to-confirm.tsx'
import { MaterialRipple } from './material-ripple.tsx'

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
    <h1 css={{ marginBottom: 0, '& + p': { marginTop: 0 } }}>Animations</h1>
    <p>
      Most animations are adapted from <a href="https://www.motion.dev">Motion</a>. Thank you for
      your work <a href="https://motion.dev/@matt">Matt Perry</a>!
    </p>
    <div
      css={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 24,
        marginTop: 40,
      }}
    >
      <Tile title="Default Animate" notes="animate prop with enter, exit, and layout">
        <DefaultAnimate />
      </Tile>
      <Tile title="Rolling Square" notes="CSS transition with spring() timing function">
        <RollingSquare />
      </Tile>
      <Tile title="Enter Animation" notes="animate.enter prop with spring physics">
        <EnterAnimation />
      </Tile>
      <Tile title="Exit Animation" notes="animate.enter and animate.exit props">
        <ExitAnimation />
      </Tile>
      <Tile title="Press Interaction" notes="CSS transition + pressDown/pressUp events">
        <Press />
      </Tile>
      <Tile title="HTML Content" notes="rAF loop with spring iterator for text">
        <HTMLContent />
      </Tile>
      <Tile title="Keyframes" notes="CSS @keyframes with infinite loop">
        <Keyframes />
      </Tile>
      <Tile title="Interruptible Keyframes" notes="Web Animations API with commitStyles()">
        <InterruptibleKeyframes />
      </Tile>
      <Tile title="Rotate" notes="CSS @keyframes (one-shot)">
        <Rotate />
      </Tile>
      <Tile title="Transition Options" notes="animate.enter with cubic-bezier + delay">
        <TransitionOptions />
      </Tile>
      <Tile title="3D Cube" notes="rAF loop with direct style manipulation">
        <Cube />
      </Tile>
      <Tile title="Shared Layout" notes="CSS Grid overlap for simultaneous enter/exit">
        <SharedLayout />
      </Tile>
      <Tile title="Aspect Ratio">
        <AspectRatio />
      </Tile>
      <Tile title="Bouncy Switch" notes="Spring up, bounce down with CSS linear()">
        <BouncySwitch />
      </Tile>
      <Tile title="FLIP Toggle" notes="animate.layout prop with interruptible WAAPI">
        <FlipToggle />
      </Tile>
      <Tile title="Reordering" notes="animate.layout with auto-shuffling list">
        <Reordering />
      </Tile>
      <Tile title="Color Interpolation" notes="sRGB vs OKLCH color space">
        <ColorInterpolation />
      </Tile>
      <Tile title="Multi-State Badge" notes="Animated icon/label swap with WAAPI shake">
        <MultiStateBadge />
      </Tile>
      <Tile title="Hold to Confirm" notes="Custom interaction with progress tracking">
        <HoldToConfirm />
      </Tile>
      <Tile title="Material Ripple" notes="Pointer-tracked ripples with enter/exit animations">
        <MaterialRipple />
      </Tile>
    </div>
  </>,
)
