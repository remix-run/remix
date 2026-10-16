import * as toggle from '@remix-run/ui/toggle'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleToggle(handle: Handle) {
  return () => (
    <div mix={styles.root}>
      <div mix={styles.card}>
        <label mix={styles.row}>
          <span>
            <strong id={`${handle.id}-label`}>Audit logging</strong>
            <span id={`${handle.id}-description`} mix={styles.muted}>
              Managed by your organization
            </span>
          </span>
          <input
            type="checkbox"
            aria-labelledby={`${handle.id}-label`}
            aria-describedby={`${handle.id}-description`}
            mix={[
              toggle.toggle({
                readOnly: true,
                defaultChecked: true,
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
  }),

  muted: css({
    display: 'block',
    fontSize: '12px',
    color: 'light-dark(#62626c, #b0b0bb)',
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
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
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
}
