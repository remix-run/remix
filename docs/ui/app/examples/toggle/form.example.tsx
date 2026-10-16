import * as toggle from '@remix-run/ui/toggle'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleToggle(handle: Handle) {
  let saved = false
  let subscribed = true
  return () => (
    <form
      autocomplete="off"
      mix={[
        on('submit', (event) => {
          event.preventDefault()
          let data = new FormData(event.currentTarget)
          subscribed = data.has('newsletter')
          saved = true
          handle.update()
        }),
        styles.root,
      ]}
    >
      <div mix={styles.card}>
        <label mix={styles.row}>
          <strong>Product newsletter</strong>
          <input
            type="checkbox"
            mix={[
              toggle.toggle({
                name: 'newsletter',
                value: 'yes',
                defaultChecked: true,
              }),
              styles.switch,
            ]}
          />
        </label>
        <button type="submit" mix={styles.button}>
          Save preferences
        </button>
        <p role="status" mix={styles.muted}>
          {saved
            ? subscribed
              ? 'Newsletter subscription saved'
              : 'Newsletter subscription removed'
            : 'Monthly product news, delivered by email'}
        </p>
      </div>
    </form>
  )
}

const styles = {
  root: css({
    '--focus-ring': 'light-dark(#70707c, #a0a0ac)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '320px',
    maxWidth: '100%',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  card: css({
    padding: '20px',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    display: 'grid',
    gap: '16px',
  }),

  row: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '8px',
    margin: '-8px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
    '@media (hover: hover)': {
      '&:hover': {
        background: 'light-dark(#f7f7fa, #24242b)',
      },
    },
    '&:active, &:has(input:active)': {
      background: 'light-dark(#eeeef3, #303038)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  switch: css({
    appearance: 'none',
    flexShrink: 0,
    width: '44px',
    height: '26px',
    margin: 0,
    padding: '3px',
    border: '1px solid light-dark(#c9c9d2, #494951)',
    borderRadius: '20px',
    background: 'light-dark(#e2e2e8, #393940)',
    cursor: 'pointer',
    transition: 'background-color 160ms ease',
    '&::after': {
      content: '""',
      display: 'block',
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 1px 3px #00000030',
      transition: 'transform 160ms ease',
    },
    '&[data-state="checked"]': {
      background: 'light-dark(#62626c, #777782)',
      borderColor: 'transparent',
    },
    '&[data-state="checked"]::after': {
      transform: 'translateX(18px)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '3px',
    },
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '&[readonly]': {
      cursor: 'default',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&::after': {
        transition: 'none',
      },
    },
  }),

  button: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '9px 14px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #25252b)',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover:not(:disabled)': {
      background: 'light-dark(#f0f0f5, #303038)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '3px',
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  }),

  muted: css({
    margin: 0,
    fontSize: '12px',
    color: 'light-dark(#62626c, #b0b0bb)',
  }),
}
