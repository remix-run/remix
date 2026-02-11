import type { Handle, Props, RemixNode } from 'remix/component'

let ease = 'cubic-bezier(0.26, 0.02, 0.23, 0.94)'

function OverlapExample(handle: Handle) {
  let shouldAnimate = false
  handle.queueTask(() => {
    shouldAnimate = true
  })

  return ({ state }: { state: boolean }) => {
    let animation = {
      enter: shouldAnimate && {
        opacity: 0,
        transform: 'scale(0.6)',
        duration: 300,
        easing: ease,
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.8)',
        duration: 300,
        easing: ease,
      },
    }

    return (
      <div
        // grid layout so children render in the same position
        css={{ display: 'grid', width: 80, height: 80, '& > *': { gridArea: '1 / 1' } }}
      >
        {state ? (
          <div key="filled" animate={animation}>
            <Circle filled>
              <FilledIcon />
            </Circle>
          </div>
        ) : (
          <div key="outline" animate={animation}>
            <Circle>
              <OutlineIcon />
            </Circle>
          </div>
        )}
      </div>
    )
  }
}

function WaitExample(handle: Handle) {
  let shouldAnimate = false
  handle.queueTask(() => {
    shouldAnimate = true
  })

  return ({ state }: { state: boolean }) => {
    let animation = {
      enter: shouldAnimate && {
        opacity: 0,
        transform: 'scale(0.6)',
        duration: 300,
        easing: ease,
        delay: 300,
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.8)',
        duration: 300,
        easing: ease,
      },
    }

    return (
      <div
        // grid layout so children render in the same position
        css={{ display: 'grid', width: 80, height: 80, '& > *': { gridArea: '1 / 1' } }}
      >
        {state ? (
          <div key="filled" animate={animation}>
            <Circle filled>
              <FilledIcon />
            </Circle>
          </div>
        ) : (
          <div key="outline" animate={animation}>
            <Circle>
              <OutlineIcon />
            </Circle>
          </div>
        )}
      </div>
    )
  }
}

export function SharedLayout(handle: Handle) {
  let state = true
  let shouldAnimate = false
  handle.queueTask(() => {
    shouldAnimate = true
  })

  return () => (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div css={{ display: 'flex', gap: 16 }}>
        <OverlapExample state={state} />
        <WaitExample state={state} />
      </div>
      <button
        css={{
          backgroundColor: '#0f1115',
          color: '#f5f5f5',
          border: 'none',
          borderRadius: 8,
          padding: '12px 32px',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'transform 100ms ease-in-out',
          '&:active': {
            transform: 'scale(0.95)',
          },
        }}
        on={{
          click() {
            state = !state
            handle.update()
          },
        }}
      >
        Switch
      </button>
    </div>
  )
}

function Circle() {
  return (props: { filled?: boolean; children: RemixNode }) => (
    <div
      css={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        backgroundColor: props.filled ? '#0f1115' : 'transparent',
        color: props.filled ? '#f5f5f5' : '#0f1115',
        border: props.filled ? '2px solid #0f1115' : '2px solid #0f1115',
      }}
    >
      {props.children}
    </div>
  )
}

function FilledIcon() {
  return () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
      <path d="m21 3-9 9" />
      <path d="M15 3h6v6" />
    </svg>
  )
}

function OutlineIcon() {
  return () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12h6" />
    </svg>
  )
}
