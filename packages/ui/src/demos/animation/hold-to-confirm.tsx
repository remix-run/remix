import { css, on, type Handle } from '@remix-run/component'
import { animateEntrance, animateExit, spring } from '@remix-run/ui/animation'
import { press } from '@remix-run/ui/press'

// Demo
const buttonExitAnimation = {
  opacity: 0,
  transform: 'scale(1.15)',
  duration: 100,
  easing: 'ease-in',
}

const confirmationEnterAnimation = {
  opacity: 0,
  transform: 'scale(0.9)',
  duration: 200,
  easing: 'ease-out',
}

export function HoldToConfirm(handle: Handle) {
  let confirmed = false

  return () => (
    <div
      mix={[
        css({
          display: 'grid',
          placeItems: 'center',
          minHeight: 140,
          // so children can animate in the same position
          '& > *': { gridArea: '1 / 1' },
        }),
      ]}
    >
      {!confirmed && (
        <HoldButton
          key="hold-button"
          onConfirm={() => {
            confirmed = true
            handle.update()
          }}
        />
      )}
      {confirmed && (
        <Confirmation
          key="confirmed"
          onReset={() => {
            confirmed = false
            handle.update()
          }}
        />
      )}
    </div>
  )
}

function HoldButton(handle: Handle<{ onConfirm: () => void }>) {
  let confirming = false

  return () => (
    <button
      mix={[
        animateExit(buttonExitAnimation),
        press({
          longPressDuration: PRESS_CONFIRM_TIME,
          onPressStart() {
            confirming = true
            handle.update()
          },
          onPressEnd() {
            confirming = false
            handle.update()
          },
          onLongPress() {
            handle.props.onConfirm()
          },
        }),
        css({
          position: 'relative',
          overflow: 'hidden',
          width: 200,
          height: 56,
          border: 'none',
          borderRadius: 12,
          backgroundColor: '#dc2626',
          color: 'white',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'transform 150ms ease',
          '&:focus': {
            outline: '3px solid rgba(220, 38, 38, 0.4)',
            outlineOffset: 2,
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        }),
      ]}
    >
      <div
        mix={[
          css({
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            transformOrigin: 'left',
          }),
        ]}
        style={{
          transform: confirming ? 'scaleX(1)' : 'scaleX(0)',
          transition: confirming
            ? `transform ${PRESS_CONFIRM_TIME}ms linear`
            : `transform ${spring({ duration: 100, bounce: 0 })}`,
        }}
      />

      <span
        mix={[
          css({
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }),
        ]}
      >
        <TrashIcon />
        Hold to Delete
      </span>
    </button>
  )
}

function Confirmation(handle: Handle<{ onReset: () => void }>) {
  return () => (
    <div
      mix={[
        animateEntrance(confirmationEnterAnimation),
        css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }),
      ]}
    >
      <div
        mix={[
          css({
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#22c55e',
            fontSize: 18,
            fontWeight: 600,
          }),
        ]}
      >
        <CheckIcon />
        Deleted
      </div>

      <button
        mix={[
          on('click', () => handle.props.onReset()),
          css({
            padding: '8px 16px',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            backgroundColor: 'white',
            color: '#64748b',
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 150ms ease',
            '&:hover': {
              backgroundColor: '#f8fafc',
              borderColor: '#cbd5e1',
            },
          }),
        ]}
      >
        Reset Demo
      </button>
    </div>
  )
}

function TrashIcon() {
  return () => (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function CheckIcon() {
  return () => (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const PRESS_CONFIRM_TIME = 2000
