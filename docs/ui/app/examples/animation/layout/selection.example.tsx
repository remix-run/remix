import { animateLayout, prefersReducedMotion, spring } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleLayout(handle: Handle) {
  let activity = false
  return () => (
    <div role="group" aria-label="Project view" mix={styles.toolbar}>
      <div
        style={{
          left: activity ? 'calc(var(--inset) + var(--overview-width))' : 'var(--inset)',
          width: activity ? 'var(--activity-width)' : 'var(--overview-width)',
        }}
        aria-hidden="true"
        inert
        mix={[animateLayout(prefersReducedMotion() ? false : spring('snappy')), styles.highlight]}
      />
      {['Overview', 'Activity log'].map((label, index) => (
        <button
          key={label}
          type="button"
          aria-pressed={activity === (index === 1)}
          mix={[
            on('click', () => {
              activity = index === 1
              handle.update()
            }),
            styles.button,
          ]}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const styles = {
  toolbar: css({
    '--inset': '5px',
    '--overview-width': '96px',
    '--activity-width': '144px',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'grid',
    gridTemplateColumns: 'var(--overview-width) var(--activity-width)',
    position: 'relative',
    padding: 'var(--inset)',
    width: 'fit-content',
    borderRadius: '10px',
    background: 'light-dark(#ececf0, #25252b)',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  highlight: css({
    position: 'absolute',
    top: 'var(--inset)',
    bottom: 'var(--inset)',
    borderRadius: '6px',
    background: 'light-dark(#fff, #393940)',
    boxShadow: '0 1px 3px #00000018',
  }),

  button: css({
    position: 'relative',
    padding: '8px 12px',
    border: 0,
    borderRadius: '6px',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '2px',
    },
  }),
}
