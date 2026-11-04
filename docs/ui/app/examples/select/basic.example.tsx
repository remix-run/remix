import * as select from '@remix-run/ui/select'
import * as popover from '@remix-run/ui/popover'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleSelect(handle: Handle) {
  return () => (
    <div mix={styles.root}>
      <span id={`${handle.id}-label`} mix={styles.label}>
        Delivery method
      </span>
      <select.Context defaultLabel="Standard delivery" defaultValue="standard">
        <button
          type="button"
          aria-labelledby={`${handle.id}-label`}
          mix={[select.trigger(), styles.trigger]}
        >
          <SelectedLabel />
          <ChevronDownIcon />
        </button>
        <popover.Context>
          <div mix={[select.popover(), styles.surface]}>
            <div aria-label="Delivery methods" mix={[select.list(), styles.list]}>
              {options.map((option) => (
                <div key={option.value} mix={[select.option(option), styles.option]}>
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        </popover.Context>
        <input mix={select.hiddenInput()} />
      </select.Context>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'grid',
    gap: '8px',
    width: '320px',
    maxWidth: '100%',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  label: css({
    fontWeight: 600,
  }),

  trigger: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
    '&:disabled': {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  }),

  surface: css({
    colorScheme: 'light dark',
    margin: 0,
    padding: '6px',
    minWidth: '220px',
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '10px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'var(--text)',
    boxShadow: '0 12px 32px #00000024',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    opacity: 0,
    transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
    '&:popover-open': {
      opacity: 1,
      '@starting-style': {
        opacity: 0,
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  list: css({
    display: 'grid',
    gap: '2px',
    maxHeight: '240px',
    overflow: 'auto',
    outline: 0,
  }),

  option: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'default',
    '&[hidden]': {
      display: 'none',
    },
    '&[data-highlighted="true"]': {
      background: 'light-dark(#eeeef3, #303038)',
    },
    '&[aria-selected="true"]': {
      background: 'light-dark(#e4e4eb, #3b3b44)',
    },
    '&[aria-disabled="true"]': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '&[aria-selected="true"][data-highlighted="true"]': {
      boxShadow: 'inset 0 0 0 1px light-dark(#a5a5af, #777782)',
    },
    '&[data-select-flash]': {
      background: 'light-dark(#d6d6e0, #4b4b56)',
    },
  }),
}

function SelectedLabel(handle: Handle) {
  let context = handle.context.get(select.Context)
  return () => <span>{context.displayedLabel}</span>
}

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}

const options = [
  { label: 'Standard delivery', value: 'standard' },
  { label: 'Express delivery', value: 'express' },
  { label: 'Collect in store', value: 'collect' },
]
