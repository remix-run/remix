import * as dialog from '@remix-run/ui/dialog'
import { css } from 'remix/component'

export default function ExampleNestedDialog() {
  return () => (
    <div mix={styles.root}>
      <dialog.Context>
        <button mix={[dialog.trigger(), dialog.focusOnHide(), styles.button]}>Open dialog</button>
        <dialog.Portal>
          <div mix={[dialog.backdrop(), styles.backdrop]} />
          <dialog.SurfaceContext>
            <section mix={[dialog.surface(), styles.surface]}>
              <h2 mix={dialog.title()}>Parent dialog</h2>
              <div mix={styles.actions}>
                <dialog.Context>
                  <button mix={[dialog.trigger(), styles.button]}>Open nested dialog</button>
                  <dialog.Portal>
                    <div mix={[dialog.backdrop(), styles.backdrop]} />
                    <dialog.SurfaceContext>
                      <section mix={[dialog.surface(), styles.surface]}>
                        <h2 mix={dialog.title()}>Nested dialog</h2>
                        <button mix={[dialog.close(), dialog.focusOnShow(), styles.button]}>
                          Close
                        </button>
                      </section>
                    </dialog.SurfaceContext>
                  </dialog.Portal>
                </dialog.Context>
                <button mix={[dialog.close(), styles.button]}>Close</button>
              </div>
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>
    </div>
  )
}

const styles = {
  button: css({
    minHeight: '40px',
    padding: '8px 14px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #25252b)',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    '&:focus': {
      outline: '2px solid currentColor',
      outlineOffset: '3px',
    },
  }),
  root: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    colorScheme: 'light dark',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 ui-sans-serif, system-ui, sans-serif',
  }),
  backdrop: css({
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
  surface: css({
    colorScheme: 'light dark',
    boxSizing: 'border-box',
    inset: 0,
    margin: 'auto',
    width: 'min(28rem, calc(100vw - 32px))',
    height: 'max-content',
    maxHeight: 'calc(100dvh - 32px)',
    overflow: 'auto',
    padding: '24px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 ui-sans-serif, system-ui, sans-serif',
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
      margin: '0 0 16px',
      fontSize: '20px',
    },
  }),
  actions: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  }),
}
