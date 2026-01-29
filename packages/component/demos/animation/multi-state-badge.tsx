import type { Handle } from 'remix/component'
import { spring } from '../../src/lib/spring.ts'

const STATES = {
  idle: 'Start',
  processing: 'Processing',
  success: 'Done',
  error: 'Something went wrong',
} as const

type State = keyof typeof STATES

function getNextState(state: State): State {
  let states = Object.keys(STATES) as State[]
  let nextIndex = (states.indexOf(state) + 1) % states.length
  return states[nextIndex]
}

const ICON_SIZE = 20
const STROKE_WIDTH = 1.5
const VIEW_BOX_SIZE = 24

let iconAnimation = {
  enter: {
    transform: 'translateY(-40px) scale(0.5)',
    filter: 'blur(6px)',
    duration: 150,
    easing: 'ease-out',
  },
  exit: {
    transform: 'translateY(40px) scale(0.5)',
    filter: 'blur(6px)',
    duration: 150,
    easing: 'ease-in',
  },
}

export function MultiStateBadge(handle: Handle) {
  let state: State = 'idle'

  return () => (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        minHeight: 80,
      }}
    >
      <button
        css={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
        on={{
          click() {
            state = getNextState(state)
            handle.update()
          },
        }}
      >
        <Badge state={state} />
      </button>
    </div>
  )
}

function Badge(handle: Handle) {
  let badgeEl: HTMLDivElement
  let prevState: State | null = null

  return (props: { state: State }) => {
    // Trigger shake/scale animations on state change
    if (prevState !== null && prevState !== props.state) {
      handle.queueTask(() => {
        if (props.state === 'error') {
          badgeEl.animate(
            {
              transform: [
                'translateX(0)',
                'translateX(-6px)',
                'translateX(6px)',
                'translateX(-6px)',
                'translateX(0)',
              ],
            },
            { duration: 300, easing: 'ease-in-out', delay: 100 },
          )
        } else if (props.state === 'success') {
          badgeEl.animate(
            { transform: ['scale(1)', 'scale(1.2)', 'scale(1)'] },
            { duration: 300, easing: 'ease-in-out' },
          )
        }
      })
    }
    prevState = props.state

    return (
      <div
        connect={(node) => (badgeEl = node)}
        css={{
          backgroundColor: '#e2e8f0',
          color: '#0f1115',
          display: 'flex',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 20px',
          fontSize: 16,
          borderRadius: 999,
          willChange: 'transform, filter',
          transition: `gap ${spring('snappy')}`,
        }}
        style={{ gap: props.state === 'idle' ? '0px' : '8px' }}
      >
        <Icon state={props.state} />
        <Label state={props.state} />
      </div>
    )
  }
}

function Icon() {
  return (props: { state: State }) => (
    <span
      css={{
        height: ICON_SIZE,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: `width ${spring({ duration: 200, bounce: 0.2 })}`,
      }}
      style={{ width: props.state === 'idle' ? 0 : ICON_SIZE }}
    >
      {props.state === 'processing' && (
        <span key="loader" css={{ position: 'absolute', left: 0, top: 0 }} animate={iconAnimation}>
          <Loader />
        </span>
      )}
      {props.state === 'success' && (
        <span key="check" css={{ position: 'absolute', left: 0, top: 0 }} animate={iconAnimation}>
          <Check />
        </span>
      )}
      {props.state === 'error' && (
        <span key="x" css={{ position: 'absolute', left: 0, top: 0 }} animate={iconAnimation}>
          <X />
        </span>
      )}
    </span>
  )
}

function Loader() {
  return () => (
    <div
      connect={(node) => {
        node.animate(
          { transform: ['rotate(0deg)', 'rotate(360deg)'] },
          { duration: 1000, iterations: Infinity },
        )
      }}
      css={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: ICON_SIZE,
        height: ICON_SIZE,
      }}
    >
      <svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  )
}

function Check() {
  return () => (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline
        points="4 12 9 17 20 6"
        connect={(node) => {
          let length = node.getTotalLength()
          node.style.strokeDasharray = `${length}`
          node.style.strokeDashoffset = `${length}`
          node.animate(
            { strokeDashoffset: [length, 0] },
            { ...spring({ duration: 300, bounce: 0.1 }), fill: 'forwards' },
          )
        }}
      />
    </svg>
  )
}

function X() {
  return () => (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        connect={(node) => {
          let length = node.getTotalLength()
          node.style.strokeDasharray = `${length}`
          node.style.strokeDashoffset = `${length}`
          node.animate(
            { strokeDashoffset: [length, 0] },
            { ...spring({ duration: 300, bounce: 0.1 }), fill: 'forwards' },
          )
        }}
      />
      <line
        x1="18"
        y1="6"
        x2="6"
        y2="18"
        connect={(node) => {
          let length = node.getTotalLength()
          node.style.strokeDasharray = `${length}`
          node.style.strokeDashoffset = `${length}`
          node.animate(
            { strokeDashoffset: [length, 0] },
            { ...spring({ duration: 300, bounce: 0.1 }), delay: 100, fill: 'forwards' },
          )
        }}
      />
    </svg>
  )
}

function Label(handle: Handle) {
  let measureEl: HTMLSpanElement
  let labelWidth = 0
  let labelHeight = 0

  // Don't animate the label on initial render
  let isFirstRender = true
  handle.queueTask(() => {
    isFirstRender = false
  })

  return (props: { state: State }) => {
    // Measure label dimensions after render
    handle.queueTask(() => {
      if (measureEl) {
        let rect = measureEl.getBoundingClientRect()
        if (rect.width !== labelWidth || rect.height !== labelHeight) {
          labelWidth = rect.width
          labelHeight = rect.height
          handle.update()
        }
      }
    })

    let labelAnimation = {
      enter: !isFirstRender && {
        transform: 'translateY(-20px)',
        opacity: 0,
        filter: 'blur(10px)',
        duration: 200,
        easing: 'ease-in-out',
      },
      exit: {
        transform: 'translateY(20px)',
        opacity: 0,
        filter: 'blur(10px)',
        duration: 200,
        easing: 'ease-in-out',
      },
    }

    return (
      <span
        css={{
          position: 'relative',
          display: 'inline-block',
          transition: `width ${spring({ duration: 200, bounce: 0.1 })}`,
        }}
        style={{
          width: labelWidth || 'auto',
          height: labelHeight || 'auto',
        }}
      >
        {/* Hidden measurement element */}
        <span
          connect={(node) => (measureEl = node)}
          css={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' }}
        >
          {STATES[props.state]}
        </span>

        {props.state === 'idle' && (
          <span
            key="idle"
            css={{ whiteSpace: 'nowrap', position: 'absolute', left: 0, top: 0 }}
            animate={labelAnimation}
          >
            {STATES.idle}
          </span>
        )}
        {props.state === 'processing' && (
          <span
            key="processing"
            css={{ whiteSpace: 'nowrap', position: 'absolute', left: 0, top: 0 }}
            animate={labelAnimation}
          >
            {STATES.processing}
          </span>
        )}
        {props.state === 'success' && (
          <span
            key="success"
            css={{ whiteSpace: 'nowrap', position: 'absolute', left: 0, top: 0 }}
            animate={labelAnimation}
          >
            {STATES.success}
          </span>
        )}
        {props.state === 'error' && (
          <span
            key="error"
            css={{ whiteSpace: 'nowrap', position: 'absolute', left: 0, top: 0 }}
            animate={labelAnimation}
          >
            {STATES.error}
          </span>
        )}
      </span>
    )
  }
}
