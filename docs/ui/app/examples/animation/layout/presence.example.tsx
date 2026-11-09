import {
  animateLayout,
  animateEntrance,
  animateExit,
  prefersReducedMotion,
  spring,
} from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleLayoutPresence(handle: Handle) {
  let visible = notifications.slice(0, 2)
  return () => {
    let reducedMotion = prefersReducedMotion()

    return (
      <div mix={styles.root}>
        <div mix={styles.header}>
          <strong>Notifications</strong>
          <button
            type="button"
            disabled={visible.length >= notifications.length}
            mix={[
              on('click', () => {
                let next = notifications.find(
                  (entry) => !visible.some((notification) => notification.id === entry.id),
                )
                if (!next) return
                visible = [...visible, next]
                handle.update()
              }),
              styles.add,
            ]}
          >
            Add notification
          </button>
        </div>
        <ol aria-label="Notifications" mix={styles.list}>
          {visible.map((notification, index) => (
            <li
              key={notification.id}
              style={{ top: `calc(${index} * (var(--row-height) + var(--row-gap)))` }}
              mix={[
                animateLayout(reducedMotion ? false : { ...spring('snappy'), size: false }),
                animateEntrance({
                  opacity: 0,
                  translate: '0 -8px',
                  duration: reducedMotion ? 0 : 180,
                }),
                animateExit({
                  position: 'absolute',
                  opacity: 0,
                  translate: '24px 0',
                  duration: reducedMotion ? 0 : 180,
                  easing: 'ease-out',
                  transition: { position: { duration: 0 } },
                }),
                styles.notification,
              ]}
            >
              <span>{notification.label}</span>
              <button
                type="button"
                aria-label={`Dismiss ${notification.label}`}
                mix={[
                  on('click', () => {
                    visible = visible.filter((entry) => entry.id !== notification.id)
                    handle.update()
                  }),
                  styles.dismiss,
                ]}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m7 7 10 10m0-10L7 17"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li
              key="empty"
              mix={[
                animateEntrance({
                  opacity: 0,
                  duration: reducedMotion ? 0 : 180,
                  easing: 'ease-out',
                }),
                animateExit({
                  opacity: 0,
                  duration: reducedMotion ? 0 : 120,
                  easing: 'ease-out',
                }),
                styles.empty,
              ]}
            >
              <svg
                aria-hidden="true"
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                mix={styles.check}
              >
                <circle cx="18" cy="18" r="17.5" stroke="var(--border)" />
                <path
                  d="m11 18 4.5 4.5L25 13"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span role="status">You're all caught up!</span>
            </li>
          )}
        </ol>
      </div>
    )
  }
}

const notifications = [
  { id: 'saved', label: 'Changes saved' },
  { id: 'export', label: 'Export ready' },
  { id: 'upload', label: 'Upload complete' },
]

const styles = {
  root: css({
    '--row-height': '64px',
    '--row-gap': '8px',
    '--text': 'light-dark(#202027, #eeeef2)',
    '--muted': 'light-dark(#62626c, #b0b0bb)',
    '--border': 'light-dark(#e0e0e6, #393940)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after': { boxSizing: 'border-box' },
    width: '360px',
    maxWidth: '100%',
    display: 'grid',
    gap: '16px',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
  }),

  add: css({
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'inherit',
    font: 'inherit',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover:not(:disabled)': { background: 'light-dark(#f0f0f5, #303038)' },
    '&:disabled': { color: 'var(--muted)', opacity: 0.6, cursor: 'not-allowed' },
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
  }),

  list: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--row-gap)',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    minHeight: 'calc(var(--row-height) * 3 + var(--row-gap) * 2)',
  }),

  notification: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    width: '100%',
    height: 'var(--row-height)',
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'light-dark(#fff, #1b1b20)',
    fontWeight: 500,
  }),

  dismiss: css({
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: '32px',
    height: '32px',
    padding: 0,
    border: 0,
    borderRadius: '50%',
    background: 'transparent',
    color: 'var(--muted)',
    font: 'inherit',
    cursor: 'pointer',
    '&:hover': { background: 'light-dark(#f0f0f5, #303038)', color: 'var(--text)' },
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '2px',
    },
  }),

  empty: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: 'var(--text)',
    fontWeight: 500,
    pointerEvents: 'none',
  }),

  check: css({
    borderRadius: '50%',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'var(--muted)',
  }),
}
