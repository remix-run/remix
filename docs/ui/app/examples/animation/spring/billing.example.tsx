import { spring } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleSpring(handle: Handle) {
  let yearly = false
  return () => (
    <div role="radiogroup" aria-label="Billing period" mix={styles.root}>
      <div data-yearly={yearly} aria-hidden="true" inert mix={styles.highlight} />
      {['Monthly', 'Yearly'].map((label, index) => (
        <label key={label} mix={styles.label}>
          <input
            type="radio"
            name={`${handle.id}-billing-period`}
            checked={yearly === (index === 1)}
            mix={on('change', () => {
              yearly = index === 1
              handle.update()
            })}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  )
}

const styles = {
  root: css({
    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '280px',
    maxWidth: '100%',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: '5px',
    background: 'light-dark(#ececf0, #25252b)',
    borderRadius: '10px',
  }),

  highlight: css({
    position: 'absolute',
    inset: '5px auto 5px 5px',
    width: 'calc(50% - 5px)',
    borderRadius: '6px',
    background: 'light-dark(#fff, #393940)',
    boxShadow: '0 1px 3px #00000018',
    transform: 'translateX(0)',
    '&[data-yearly="true"]': {
      transform: 'translateX(100%)',
    },
    transition: spring.transition('transform', 'snappy'),
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  label: css({
    position: 'relative',
    cursor: 'pointer',
    textAlign: 'center',
    '& input': {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      margin: 0,
      opacity: 0,
      cursor: 'pointer',
    },
    '& span': {
      display: 'block',
      padding: '9px',
      borderRadius: '6px',
      fontWeight: 600,
    },
    '& input:focus-visible + span': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '2px',
    },
  }),
}
