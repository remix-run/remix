import type { Handle, Props } from 'remix/component'
import { css, on } from 'remix/component'

interface PendingButtonProps extends Props<'button'> {
  pending?: boolean
  failed?: boolean
  pendingLabel?: string
  errorMessage?: string
}

export function PendingButton(handle: Handle<PendingButtonProps>) {
  let state: 'idle' | 'pending' | 'failed' | 'animatingFailure' = 'idle'

  return () => {
    let {
      children,
      pending = state === 'pending',
      failed = state === 'failed' || state === 'animatingFailure',
      pendingLabel = 'Saving…',
      errorMessage,
      type = 'submit',
      class: className = 'btn',
      mix = [],
      ...props
    } = handle.props

    return (
      <>
        <button
          {...props}
          type={type}
          class={className}
          mix={[
            on('rmx:submission', async (event, signal) => {
              state = 'pending'
              handle.update()
              try {
                await event.finished
                if (signal.aborted) return
                state = 'idle'
              } catch {
                if (signal.aborted) return
                state = 'failed'
              }
              handle.update()
            }),
            on('animationstart', async (event, signal) => {
              if (
                event.target !== event.currentTarget ||
                event.animationName !== 'pending-button-failure'
              ) {
                return
              }
              let animation = event.currentTarget
                .getAnimations()
                .find(
                  (animation) =>
                    animation instanceof CSSAnimation &&
                    animation.animationName === event.animationName,
                )
              if (!animation) return
              state = 'animatingFailure'
              handle.update()
              await animation.finished.catch(() => {})
              if (signal.aborted || state !== 'animatingFailure') return
              state = 'failed'
              handle.update()
            }),
            css({
              animation: failed ? 'pending-button-failure 2000ms ease-in-out' : 'none',
              '@keyframes pending-button-failure': {
                '0%, 20%, 100%': { transform: 'translateX(0) scale(1)' },
                '4%, 100%': {
                  backgroundColor: '#dc2626',
                  color: '#fff',
                },
                '4%, 12%': { transform: 'translateX(-3px) scale(1.04)' },
                '8%, 16%': { transform: 'translateX(3px) scale(1.04)' },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }),
            ...mix,
          ]}
        >
          {pending ? pendingLabel : state === 'animatingFailure' ? 'Failed!' : children}
        </button>
        {errorMessage ? (
          <span
            role="status"
            mix={css({ color: '#e74c3c', '&:not(:empty)': { marginLeft: '0.5rem' } })}
          >
            {failed ? errorMessage : ''}
          </span>
        ) : null}
      </>
    )
  }
}
