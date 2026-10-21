import * as popover from '@remix-run/ui/popover'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExamplePopover(handle: Handle) {
  let open = false
  return () => (
    <div mix={styles.root}>
      <popover.Context>
        <button
          type="button"
          aria-label="Filter pull requests"
          aria-controls={`${handle.id}-surface`}
          aria-expanded={open}
          mix={[
            popover.anchor({
              placement: 'bottom',
              offset: 8,
            }),
            popover.focusOnHide(),
            on('click', () => {
              open = !open
              handle.update()
            }),
            styles.button,
          ]}
        >
          <FilterIcon />
        </button>
        <div
          id={`${handle.id}-surface`}
          role="dialog"
          aria-label="Filter pull requests"
          mix={[
            popover.surface({
              open,
              onHide() {
                open = false
                handle.update()
              },
            }),
            styles.surface,
          ]}
        >
          <fieldset mix={styles.filters}>
            <legend>Status</legend>
            <label mix={styles.checkbox}>
              <input
                type="checkbox"
                name="status"
                value="open"
                defaultChecked
                mix={popover.focusOnShow()}
              />
              Open
            </label>
            <label mix={styles.checkbox}>
              <input type="checkbox" name="status" value="merged" />
              Merged
            </label>
            <label mix={styles.checkbox}>
              <input type="checkbox" name="status" value="closed" />
              Closed
            </label>
          </fieldset>
        </div>
      </popover.Context>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',
    '--hover-control': 'light-dark(#f0f0f5, #303038)',
    '--accent': 'light-dark(#40404a, #d8d8df)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '320px',
    maxWidth: '100%',
    display: 'flex',
    justifyContent: 'center',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  button: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #25252b)',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    '&:hover': {
      background: 'var(--hover-control)',
    },
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
  }),

  surface: css({
    colorScheme: 'light dark',
    margin: 0,
    padding: '12px',
    width: '196px',
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '10px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'var(--text)',
    boxShadow: '0 12px 32px #00000024',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    opacity: 0,
    transform: 'scale(0.98)',
    transformOrigin: 'top center',
    transition:
      'opacity 140ms ease, transform 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
    '&[data-anchor-placement^="top"]': {
      transformOrigin: 'bottom center',
    },
    '&:popover-open': {
      opacity: 1,
      transform: 'scale(1)',
      '@starting-style': {
        opacity: 0,
        transform: 'scale(0.98)',
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  filters: css({
    margin: 0,
    padding: 0,
    border: 0,
    '& legend': {
      padding: '0 8px 6px',
      fontSize: '12px',
      fontWeight: 600,
      color: 'light-dark(#62626c, #b0b0bb)',
    },
  }),

  checkbox: css({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '40px',
    padding: '8px',
    borderRadius: '5px',
    fontSize: '13px',
    cursor: 'pointer',
    '&:hover': {
      background: 'var(--hover-control)',
    },
    '& input': {
      margin: 0,
      width: '16px',
      height: '16px',
      accentColor: 'var(--accent)',
    },
    '& input:focus-visible': {
      outline: '2px solid var(--accent)',
      outlineOffset: '3px',
    },
  }),
}

function FilterIcon() {
  return () => (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    >
      <path d="M4 7h16M4 17h16M9 4v6M15 14v6" />
    </svg>
  )
}
