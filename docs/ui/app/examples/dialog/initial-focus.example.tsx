import * as dialog from '@remix-run/ui/dialog'
import { css } from 'remix/component'

export default function ExampleInitialFocusDialog() {
  return () => (
    <div
      mix={css({
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
        colorScheme: 'light dark',
        color: 'light-dark(#202027, #eeeef2)',
      })}
    >
      <dialog.Context>
        <button mix={[dialog.trigger(), buttonStyle]}>Open dialog</button>
        <dialog.Portal>
          <div
            mix={[
              dialog.backdrop(),
              css({
                background: '#0006',
                opacity: 1,
                transition: 'opacity 140ms ease',
                '&[data-state="closed"]': {
                  opacity: 0,
                },
                '@starting-style': {
                  opacity: 0,
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
              }),
            ]}
          />
          <dialog.SurfaceContext>
            <section
              mix={[
                dialog.surface(),
                css({
                  colorScheme: 'light dark',
                  boxSizing: 'border-box',
                  inset: 0,
                  margin: 'auto',
                  height: 'max-content',
                  width: 'min(24rem, calc(100vw - 32px))',
                  maxHeight: 'calc(100dvh - 32px)',
                  overflow: 'auto',
                  overflowWrap: 'anywhere',
                  padding: '24px',
                  border: '1px solid light-dark(#e0e0e6, #393940)',
                  borderRadius: '12px',
                  background: 'light-dark(#fff, #1b1b20)',
                  color: 'light-dark(#202027, #eeeef2)',
                  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
                  boxShadow: '0 16px 48px #0004',
                  opacity: 1,
                  transition: 'opacity 140ms ease',
                  '&[data-state="closed"]': {
                    opacity: 0,
                  },
                  '@starting-style': {
                    opacity: 0,
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                  },
                  '& h2': {
                    margin: 0,
                    fontSize: '20px',
                  },
                  '& p': {
                    margin: '8px 0 20px',
                  },
                }),
              ]}
            >
              <h2 mix={dialog.title()}>Custom initial focus</h2>
              <p mix={dialog.description()}>
                Cancel receives focus when this dialog opens, even though Confirm comes first.
              </p>
              <div mix={css({ display: 'flex', gap: '8px' })}>
                <button mix={[dialog.close(), buttonStyle]}>Confirm</button>
                <button mix={[dialog.close(), dialog.focusOnShow(), buttonStyle]}>Cancel</button>
              </div>
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>
    </div>
  )
}

const buttonStyle = css({
  minHeight: '44px',
  padding: '8px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  '&:focus': {
    outline: '2px solid light-dark(#70707c, #a0a0ac)',
    outlineOffset: '3px',
  },
})
