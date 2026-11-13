import type { Handle, Props } from 'remix/component'
import { css, on } from 'remix/component'

interface PendingButtonProps extends Props<'button'> {
  pending?: boolean
  failed?: boolean
  pendingLabel?: string
  errorMessage?: string
}

export function PendingButton(handle: Handle<PendingButtonProps>) {
  let saving = false
  let submissionFailed = false

  return () => {
    let {
      children,
      pending = saving,
      failed = submissionFailed,
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
              saving = true
              submissionFailed = false
              handle.update()
              try {
                await event.finished
              } catch {
                if (!signal.aborted) submissionFailed = true
              }
              // The button's next submission, or its removal, aborts the signal.
              if (signal.aborted) return
              saving = false
              handle.update()
            }),
            css({
              animation: failed ? 'pending-button-failure 400ms ease-in-out' : 'none',
              '@keyframes pending-button-failure': {
                '0%, 100%': {
                  transform: 'translateX(0)',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                },
                '20%, 60%': { transform: 'translateX(-3px)' },
                '40%, 80%': { transform: 'translateX(3px)' },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }),
            ...mix,
          ]}
        >
          {pending ? pendingLabel : children}
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
