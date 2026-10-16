import * as listbox from '@remix-run/ui/listbox'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleListbox(handle: Handle) {
  let value: string | null = 'standard'
  let activeValue: string | null = null
  let activeId: string | undefined

  return () => (
    <div mix={styles.root}>
      <div mix={styles.card}>
        <strong mix={styles.title}>Delivery method</strong>
        <listbox.Context
          value={value}
          activeValue={activeValue}
          onSelect={(next) => {
            value = next
            handle.update()
          }}
          onHighlight={(next, option) => {
            activeValue = next
            activeId = option?.id
            handle.update()
          }}
        >
          <div
            tabIndex={0}
            aria-label="Delivery method"
            aria-activedescendant={activeId}
            mix={[listbox.list(), styles.list]}
          >
            {options.map((option) => (
              <div key={option.value} mix={[listbox.option(option), styles.option]}>
                <span>
                  <strong>{option.label}</strong>
                  <span mix={styles.muted}>{option.detail}</span>
                </span>
                <span aria-hidden="true" mix={styles.iconSlot}>
                  {value === option.value && <CheckIcon />}
                </span>
              </div>
            ))}
          </div>
        </listbox.Context>
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
    padding: '20px 8px 8px',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    display: 'grid',
    gap: '12px',
  }),

  title: css({
    paddingInline: '12px',
    fontWeight: 600,
  }),

  list: css({
    borderRadius: '6px',
    display: 'grid',
    gap: '2px',
    maxHeight: '240px',
    overflow: 'auto',
    outline: 0,
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
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
      color: 'light-dark(#94949f, #72727e)',
      cursor: 'not-allowed',
    },
    '&[aria-selected="true"][data-highlighted="true"]': {
      boxShadow: 'inset 0 0 0 1px light-dark(#a5a5af, #777782)',
    },
    '&[data-listbox-flash]': {
      background: 'light-dark(#d6d6e0, #4b4b56)',
    },
  }),

  muted: css({
    display: 'block',
    fontSize: '12px',
    color: 'light-dark(#62626c, #b0b0bb)',
  }),

  iconSlot: css({
    width: '16px',
    display: 'inline-flex',
  }),
}

function CheckIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path
        d="m5 12 4 4L19 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

const options = [
  {
    value: 'standard',
    label: 'Standard',
    detail: 'Arrives in 5 to 7 business days',
    textValue: ['standard', 'regular'],
  },
  {
    value: 'express',
    label: 'Express',
    detail: 'Arrives in 1 to 2 business days',
    textValue: ['express', 'expedited'],
  },
  {
    value: 'same-day',
    label: 'Same-day',
    detail: 'Unavailable for this address',
    disabled: true,
  },
]
