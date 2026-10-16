import * as menu from '@remix-run/ui/menu'
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleMenu(handle: Handle) {
  let sort = 'name'
  return () => (
    <div
      mix={[
        menu.onMenuSelect((event) => {
          if (event.item.name === 'sort' && event.item.value) {
            sort = event.item.value
            handle.update()
          }
        }),
        styles.root,
      ]}
    >
      <menu.Context label="Sort by">
        <button
          type="button"
          mix={[
            menu.trigger({
              offset: 8,
            }),
            styles.button,
          ]}
        >
          Sort by <ChevronDownIcon />
        </button>
        <div mix={[menu.popover(), styles.surface]}>
          <div mix={[menu.list(), styles.list]}>
            <div role="group" aria-label="Sort by">
              {options.map((option) => (
                <div
                  key={option.value}
                  mix={[
                    menu.item({
                      name: 'sort',
                      value: option.value,
                      type: 'radio',
                      checked: sort === option.value,
                    }),
                    styles.item,
                  ]}
                >
                  {option.label}
                  <span
                    aria-hidden="true"
                    mix={css({
                      opacity: sort === option.value ? 1 : 0,
                    })}
                  >
                    <CheckIcon />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </menu.Context>
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
    width: 'fit-content',
    maxWidth: '100%',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
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
    '&[data-close-animation="none"]': {
      transition: 'none',
    },
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

  item: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '9px 12px',
    borderRadius: '6px',
    outline: 0,
    cursor: 'default',
    '&[data-highlighted]': {
      background: 'light-dark(#eeeef3, #303038)',
    },
    '&[data-menu-flash]': {
      background: 'light-dark(#dedee7, #454550)',
      color: 'light-dark(#202027, #eeeef2)',
    },
    '&[aria-disabled]': {
      opacity: 0.4,
    },
  }),
}

function ChevronDownIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
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
  { value: 'name', label: 'Name' },
  { value: 'modified', label: 'Last modified' },
  { value: 'size', label: 'Size' },
  { value: 'kind', label: 'Kind' },
]
