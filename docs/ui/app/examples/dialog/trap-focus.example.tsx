import * as dialog from '@remix-run/ui/dialog'
import { css } from 'remix/component'

export default function ExampleFocusTrapDialog() {
  return () => (
    <div mix={styles.root}>
      <dialog.Context modal="trap-focus" closeOnOutsideClick={false}>
        <button mix={[dialog.trigger(), styles.button]}>Open dialog</button>
        <dialog.Portal>
          <dialog.SurfaceContext>
            <section mix={[dialog.surface(), styles.surface]}>
              <h2 mix={dialog.title()}>Dialog with trapped focus</h2>
              <p mix={dialog.description()}>
                Focus is trapped within this dialog while background page content can still be
                scrolled.
              </p>
              <button mix={[dialog.close(), styles.button]}>Close</button>
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
      margin: 0,
      fontSize: '20px',
    },
    '& p': {
      margin: '8px 0 16px',
    },
  }),
}
