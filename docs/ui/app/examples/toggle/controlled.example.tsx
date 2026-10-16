import * as toggle from '@remix-run/ui/toggle'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleToggle(handle: Handle) {
  let showPassword = false
  let password = 'remix-ui-demo'
  return () => (
    <div mix={styles.root}>
      <div mix={styles.card}>
        <label mix={styles.field}>
          <strong>Password</strong>
          <input
            {...(showPassword ? { type: 'text' } : { type: 'password' })}
            autocomplete="off"
            value={password}
            mix={[
              on('input', (event) => {
                password = event.currentTarget.value
                handle.update()
              }),
              styles.input,
            ]}
          />
        </label>
        <label mix={styles.row}>
          <span>Show password</span>
          <input
            type="checkbox"
            mix={[
              toggle.toggle({
                checked: showPassword,
                onCheckedChange(next) {
                  showPassword = next
                  handle.update()
                },
              }),
              styles.switch,
            ]}
          />
        </label>
      </div>
    </div>
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

  field: css({
    display: 'grid',
    gap: '8px',
  }),

  input: css({
    width: '100%',
    minWidth: 0,
    padding: '10px 12px',
    border: '1px solid light-dark(#c9c9d2, #494951)',
    borderRadius: '6px',
    background: 'light-dark(#fff, #24242b)',
    color: 'inherit',
    font: 'inherit',
    '&:focus-visible': {
      outline: '2px solid var(--focus-ring)',
      outlineOffset: '3px',
    },
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
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&::after': {
        transition: 'none',
      },
    },
  }),
}
