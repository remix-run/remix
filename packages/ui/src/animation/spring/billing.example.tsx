import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { spring } from '@remix-run/ui/animation'

export default function Example(handle: Handle) {
  let yearly = false
  return () => (
    <div
      role="radiogroup"
      aria-label="Billing period"
      mix={css({
        colorScheme: 'light dark',
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
      })}
    >
      <div
        aria-hidden="true"
        inert
        mix={css({
          position: 'absolute',
          inset: '5px auto 5px 5px',
          width: 'calc(50% - 5px)',
          borderRadius: '6px',
          background: 'light-dark(#fff, #393940)',
          boxShadow: '0 1px 3px #00000018',
          transform: yearly ? 'translateX(100%)' : 'translateX(0)',
          transition: spring.transition('transform', 'snappy'),
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        })}
      />
      {['Monthly', 'Yearly'].map((label, index) => (
        <label
          key={label}
          mix={css({
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
            '& span': { display: 'block', padding: '9px', borderRadius: '6px', fontWeight: 600 },
            '& input:focus-visible + span': {
              outline: '2px solid #5bb8ef',
              outlineOffset: '2px',
            },
          })}
        >
          <input
            type="radio"
            name="billing-period"
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
