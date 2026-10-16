import * as menu from '@remix-run/ui/menu'
import { css } from 'remix/component'

export default function ExampleMenu() {
  return () => (
    <div mix={styles.root}>
      <menu.Context label="File">
        <button
          type="button"
          mix={[
            menu.trigger({
              offset: 8,
            }),
            styles.button,
          ]}
        >
          File <ChevronDownIcon />
        </button>
        <div mix={[menu.popover(), styles.surface]}>
          <div mix={[menu.list(), styles.list]}>
            <div
              mix={[
                menu.item({
                  name: 'new',
                }),
                styles.item,
              ]}
            >
              New file
            </div>
            <div
              mix={[
                menu.item({
                  name: 'open',
                }),
                styles.item,
              ]}
            >
              Open file
            </div>
            <menu.Context label="Export as">
              <div
                mix={[
                  menu.submenuTrigger({
                    label: 'Export as',
                  }),
                  styles.item,
                ]}
              >
                Export as <ChevronRightIcon />
              </div>
              <div mix={[menu.popover(), styles.surface]}>
                <div mix={[menu.list(), styles.list]}>
                  <div
                    mix={[
                      menu.item({
                        name: 'export',
                        value: 'pdf',
                      }),
                      styles.item,
                    ]}
                  >
                    PDF
                  </div>
                  <div
                    mix={[
                      menu.item({
                        name: 'export',
                        value: 'png',
                      }),
                      styles.item,
                    ]}
                  >
                    PNG
                  </div>
                  <div
                    mix={[
                      menu.item({
                        name: 'export',
                        value: 'svg',
                      }),
                      styles.item,
                    ]}
                  >
                    SVG
                  </div>
                </div>
              </div>
            </menu.Context>
            <div
              mix={[
                menu.item({
                  name: 'print',
                }),
                styles.item,
              ]}
            >
              Print
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

function ChevronRightIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}
