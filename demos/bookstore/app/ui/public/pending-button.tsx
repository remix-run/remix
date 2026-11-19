import type { Handle, Props } from 'remix/component'
import { css, on } from 'remix/component'

interface PendingButtonProps extends Props<'button'> {
  pending?: boolean
  failed?: boolean
  pendingLabel?: string
  errorMessage?: string
}

export function PendingButton(handle: Handle<PendingButtonProps>) {
  let state: 'idle' | 'pending' | 'failed' | 'showingFailure' = 'idle'
  let wasFailed = false
  let failureTimer: ReturnType<typeof setTimeout> | undefined
  handle.signal.addEventListener('abort', () => clearTimeout(failureTimer), { once: true })

  return () => {
    let {
      children,
      pending = state === 'pending',
      failed = state === 'failed' || state === 'showingFailure',
      pendingLabel = 'Saving…',
      errorMessage,
      type = 'submit',
      class: className = 'btn',
      mix = [],
      ...props
    } = handle.props

    if (failed && !wasFailed) {
      handle.queueTask((signal) => {
        if (signal.aborted) return
        state = 'showingFailure'
        failureTimer = setTimeout(() => {
          state = 'failed'
          handle.update()
        }, 2000)
        handle.update()
      })
    } else if (!failed) {
      clearTimeout(failureTimer)
      if (state === 'showingFailure' || state === 'failed') state = pending ? 'pending' : 'idle'
    }
    wasFailed = failed
    let showingFailure = state === 'showingFailure'

    return (
      <>
        <button
          {...props}
          type={type}
          class={className}
          mix={[
            on('rmx:navigation', async (event, signal) => {
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
            css({
              backgroundColor: showingFailure ? '#dc2626' : undefined,
              color: showingFailure ? '#fff' : undefined,
              transition: 'background-color 150ms, color 150ms',
              animation: showingFailure ? 'pending-button-failure 400ms ease-in-out' : 'none',
              '@keyframes pending-button-failure': {
                '0%, 100%': { transform: 'translateX(0) scale(1)' },
                '20%, 60%': { transform: 'translateX(-3px) scale(1.04)' },
                '40%, 80%': { transform: 'translateX(3px) scale(1.04)' },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }),
            ...mix,
          ]}
        >
          {pending ? pendingLabel : showingFailure ? 'Failed!' : children}
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
