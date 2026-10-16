import * as listbox from '@remix-run/ui/listbox'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleListbox(handle: Handle) {
  let value: string | null = 'design'
  let activeValue: string | null = null
  let activeId: string | undefined
  return () => (
    <div mix={styles.root}>
      <div mix={styles.card}>
        <strong>Assign to team</strong>
        <listbox.Context
          flashSelection
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
            aria-label="Team"
            aria-activedescendant={activeId}
            mix={[styles.list, listbox.list()]}
          >
            {options.map((option) => (
              <div key={option.value} mix={[styles.option, listbox.option(option)]}>
                <span>{option.label}</span>
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
    '--accent': 'light-dark(#0578be, #80caff)',

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

  list: css({
    display: 'grid',
    gap: '2px',
    maxHeight: '240px',
    overflow: 'auto',
    outline: 0,
    '&:focus-visible': {
      outline: '2px solid #5bb8ef',
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
      color: 'var(--accent)',
      background: 'light-dark(#eaf5fc, #173348)',
    },
    '&[aria-disabled="true"]': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '&[data-listbox-flash]': {
      background: 'light-dark(#d6eaf8, #254c66)',
      color: 'var(--accent)',
    },
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
  { value: 'design', label: 'Design' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'marketing', label: 'Marketing' },
]
