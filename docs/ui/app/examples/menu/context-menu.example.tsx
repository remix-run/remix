import * as menu from '@remix-run/ui/menu'
import { css } from 'remix/component'

export default function ExampleMenu() {
  return () => (
    <div mix={styles.root}>
      <menu.Context label="File actions">
        <div tabIndex={0} mix={[menu.contextTrigger(), styles.target]}>
          <FileIcon />
          <span>Notes.txt</span>
        </div>
        <div mix={[menu.popover(), styles.surface]}>
          <div mix={[menu.list(), styles.list]}>
            <div
              mix={[
                menu.item({
                  name: 'rename',
                }),
                styles.item,
              ]}
            >
              Rename
            </div>
            <div
              mix={[
                menu.item({
                  name: 'duplicate',
                }),
                styles.item,
              ]}
            >
              Duplicate
            </div>
            <div
              mix={[
                menu.item({
                  name: 'move-to-trash',
                }),
                styles.item,
              ]}
            >
              Move to trash
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
    '--border': 'light-dark(#e0e0e6, #393940)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '300px',
    maxWidth: '100%',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  target: css({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'light-dark(#fff, #25252b)',
    fontWeight: 500,
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
  }),

  surface: css({
    colorScheme: 'light dark',
    margin: 0,
    padding: '6px',
    minWidth: '220px',
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid var(--border)',
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
    outline: 0,
  }),

  item: css({
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
  }),
}

function FileIcon() {
  return () => (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 3H6v18h12V7l-4-4Z M14 3v5h4 M9 12h6 M9 16h6"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  )
}
