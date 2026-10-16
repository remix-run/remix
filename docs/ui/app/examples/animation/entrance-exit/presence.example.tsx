import { animateEntrance, animateExit, prefersReducedMotion, spring } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleEntranceExit(handle: Handle) {
  let visible = true
  return () => {
    let timing = prefersReducedMotion() ? { duration: 0 } : spring('snappy')
    return (
      <div mix={styles.root}>
        <button
          type="button"
          aria-expanded={visible}
          aria-controls={`${handle.id}-notification`}
          mix={[
            on('click', () => {
              visible = !visible
              handle.update()
            }),
            styles.button,
          ]}
        >
          <PlusIcon expanded={visible} />
          {visible ? 'Hide notification' : 'Show notification'}
        </button>
        <div
          id={`${handle.id}-notification`}
          mix={css({
            minHeight: '96px',
            display: 'grid',
            alignItems: 'center',
          })}
        >
          {visible && (
            <div
              key="notification"
              mix={[
                animateEntrance({
                  opacity: 0,
                  transform: 'translateY(8px) scale(0.98)',
                  ...timing,
                }),
                animateExit({
                  opacity: 0,
                  transform: 'translateY(-8px) scale(0.98)',
                  ...timing,
                }),
                styles.notification,
              ]}
            >
              <SuccessIcon />
              <div role="status">
                <strong>Changes saved</strong>
                <p
                  mix={css({
                    margin: 0,
                    fontSize: '12px',
                    color: 'light-dark(#62626c, #b0b0bb)',
                  })}
                >
                  Your preferences are up to date.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
}

const styles = {
  root: css({
    '--surface': 'light-dark(#fff, #1b1b20)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'grid',
    gap: '24px',
    width: '360px',
    maxWidth: '100%',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  button: css({
    justifySelf: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minWidth: '200px',
    padding: '9px 14px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'var(--surface)',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover': {
      background: 'light-dark(#f0f0f5, #303038)',
    },
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
  }),

  notification: css({
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '18px',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '12px',
    background: 'var(--surface)',
  }),
}

function PlusIcon(handle: Handle<{ expanded: boolean }>) {
  return () => (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      mix={css({
        transform: handle.props.expanded ? 'rotate(45deg)' : 'rotate(0)',
        transition: 'transform 160ms ease',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      })}
    >
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  )
}

function SuccessIcon() {
  return () => (
    <svg
      aria-hidden="true"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      mix={css({
        flexShrink: 0,
        color: 'light-dark(#62626c, #b0b0bb)',
      })}
    >
      <rect width="32" height="32" rx="10" fill="currentColor" opacity="0.12" />
      <path
        d="m10 16 4 4 8-8"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
