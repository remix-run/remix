import { easings, prefersReducedMotion, tween } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleTween(handle: Handle) {
  let amount = 12480
  let period = 'month'
  let frame = 0
  handle.signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true })

  function selectPeriod(item: (typeof periods)[number]) {
    period = item.value
    cancelAnimationFrame(frame)
    if (prefersReducedMotion()) {
      amount = item.amount
      handle.update()
      return
    }
    let animation = tween({
      from: amount,
      to: item.amount,
      duration: 600,
      curve: easings.easeOut,
    })
    animation.next()
    handle.update()

    function tick(timestamp: number) {
      let next = animation.next(timestamp)
      amount = next.value
      handle.update()
      if (!next.done) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
  }

  return () => (
    <div mix={[styles.root, styles.surface]}>
      <div mix={styles.header}>
        <strong>Revenue</strong>
        <div role="radiogroup" aria-label="Revenue period" mix={styles.toolbar}>
          {periods.map((item) => (
            <label key={item.value}>
              <input
                type="radio"
                name={`${handle.id}-revenue-period`}
                checked={period === item.value}
                mix={on('change', () => selectPeriod(item))}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <strong mix={styles.amount}>${Math.round(amount).toLocaleString('en-US')}</strong>
      </div>
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
    width: '320px',
    maxWidth: '100%',
    display: 'grid',
    gap: '20px',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  surface: css({
    padding: '24px',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
  }),

  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  }),

  toolbar: css({
    display: 'flex',
    gap: '4px',
    padding: '4px',
    borderRadius: '9px',
    background: 'light-dark(#ececf0, #25252b)',
    border: '1px solid var(--border)',
    '& label': {
      position: 'relative',
      cursor: 'pointer',
    },
    '& input': {
      position: 'absolute',
      opacity: 0,
      width: '100%',
      height: '100%',
      inset: 0,
      margin: 0,
      cursor: 'pointer',
    },
    '& span': {
      display: 'block',
      padding: '6px 12px',
      borderRadius: '5px',
      fontSize: '12px',
      fontWeight: 600,
      color: 'light-dark(#62626c, #b0b0bb)',
      transition: 'background-color 160ms ease, color 160ms ease',
    },
    '& input:checked + span': {
      background: 'light-dark(#fff, #393940)',
      color: 'var(--text)',
      boxShadow: '0 1px 3px #00000018',
    },
    '& input:focus-visible + span': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '2px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& span': {
        transition: 'none',
      },
    },
  }),

  amount: css({
    fontSize: '40px',
    lineHeight: 1.4,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums',
  }),
}

const periods = [
  { value: 'day', label: '1D', amount: 416 },
  { value: 'week', label: '1W', amount: 2912 },
  { value: 'month', label: '1M', amount: 12480 },
]
