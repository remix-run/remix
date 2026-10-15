import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { animateEntrance, animateExit, prefersReducedMotion, spring } from '@remix-run/ui/animation'

export default function Example(handle: Handle) {
  let visible = true
  return () => {
    let timing = prefersReducedMotion() ? { duration: 0 } : { ...spring('snappy') }
    return (
      <div mix={stackCss}>
        <button
          type="button"
          aria-expanded={visible}
          aria-controls="notification-preview"
          mix={[
            buttonCss,
            on('click', () => {
              visible = !visible
              handle.update()
            }),
          ]}
        >
          <PlusIcon expanded={visible} />
          {visible ? 'Hide notification' : 'Show notification'}
        </button>
        <div id="notification-preview" mix={css({ minHeight: '120px' })}>
          {visible && (
            <div
              key="notification"
              mix={[
                notificationCss,
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
              ]}
            >
              <SuccessIcon />
              <div role="status">
                <strong>Changes saved</strong>
                <p
                  mix={css({ margin: 0, fontSize: '12px', color: 'light-dark(#62626c, #b0b0bb)' })}
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
const stackCss = css({
  colorScheme: 'light dark',
  display: 'grid',
  gap: '24px',
  width: '360px',
  maxWidth: '100%',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})
const buttonCss = css({
  justifySelf: 'center',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minWidth: '200px',
  padding: '9px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
})
const notificationCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '18px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
})

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
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
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
      mix={css({ flexShrink: 0, color: 'light-dark(#167b50, #7ad6ad)' })}
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
