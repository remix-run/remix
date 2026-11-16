import { Portal } from '@remix-run/ui/portal'
import { css, on, type Handle } from 'remix/component'

export default function ExamplePortal(handle: Handle) {
  let open = false
  return () => (
    <div
      mix={css({
        display: 'flex',
        justifyContent: 'center',
        colorScheme: 'light dark',
        boxSizing: 'border-box',
        padding: '6px',
        overflow: 'hidden',
        transform: 'translate(0)',
        width: '320px',
        maxWidth: '100%',
      })}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${handle.id}-content` : undefined}
        mix={[
          on('click', () => {
            open = !open
            void handle.update()
          }),
          css({
            minWidth: '120px',
            padding: '8px 12px',
            border: '1px solid light-dark(#c9c9d2, #494951)',
            borderRadius: '6px',
            background: 'light-dark(#fff, #29292f)',
            color: 'light-dark(#202027, #eeeef2)',
            font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
            cursor: 'pointer',
            '&:hover': { background: 'light-dark(#f0f0f5, #303038)' },
            '&:focus': {
              outline: '2px solid light-dark(#70707c, #a0a0ac)',
              outlineOffset: '3px',
            },
          }),
        ]}
      >
        {open ? 'Hide content' : 'Show content'}
      </button>
      <Portal>
        {open ? (
          <div
            id={`${handle.id}-content`}
            role="status"
            mix={css({
              position: 'fixed',
              colorScheme: 'light dark',
              bottom: '24px',
              right: '24px',
              zIndex: 1000,
              maxWidth: 'calc(100vw - 48px)',
              padding: '16px 20px',
              border: '1px solid light-dark(#c9c9d2, #494951)',
              borderRadius: '8px',
              background: 'light-dark(#fff, #29292f)',
              color: 'light-dark(#202027, #eeeef2)',
              font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
              boxShadow: '0 8px 24px #00000024',
            })}
          >
            Portaled content
          </div>
        ) : null}
      </Portal>
    </div>
  )
}
