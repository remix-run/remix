import { anchor } from '@remix-run/ui/anchor'
import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleAnchor(handle: Handle) {
  let selected = 3
  let surface: HTMLElement | undefined
  let buttons: HTMLButtonElement[] = []
  let points: HTMLElement[] = []
  let cleanup = () => {}

  function selectPoint(index: number) {
    if (selected === index) return
    let target = points[index]
    if (!target) return
    selected = index
    cleanup()
    if (surface) cleanup = anchor(surface, target, { placement: 'top', offset: 10 })
    handle.update()
  }

  return () => (
    <div
      mix={[
        ref((node, signal) => {
          let observer = new IntersectionObserver(
            ([entry]) => {
              if (surface)
                surface.style.visibility = entry.intersectionRatio === 1 ? 'visible' : 'hidden'
            },
            {
              threshold: 1,
            },
          )
          observer.observe(node)
          signal.addEventListener('abort', () => observer.disconnect(), {
            once: true,
          })
        }),
        styles.root,
      ]}
    >
      <div mix={styles.heading}>Visits</div>
      <div role="group" aria-label="Daily visits" mix={styles.plot}>
        <ChartLine />
        {days.map((day, index) => (
          <button
            key={day.label}
            type="button"
            aria-label={`${day.label}, ${day.visits.toLocaleString('en-US')} visits`}
            aria-pressed={selected === index}
            tabIndex={selected === index ? 0 : -1}
            data-day={index}
            mix={[
              ref((node: HTMLButtonElement) => {
                buttons[index] = node
              }),
              on('pointerenter', () => selectPoint(index)),
              on('focus', () => selectPoint(index)),
              on('click', () => selectPoint(index)),
              on('keydown', (event) => {
                let next = index
                if (event.key === 'ArrowRight') next = Math.min(days.length - 1, index + 1)
                else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
                else if (event.key === 'Home') next = 0
                else if (event.key === 'End') next = days.length - 1
                else return
                event.preventDefault()
                buttons[next]?.focus()
              }),
              styles.day,
            ]}
          >
            <span
              data-point
              aria-hidden="true"
              style={{
                top: `${100 - (day.visits / 2000) * 100}%`,
              }}
              mix={[
                ref((node) => {
                  points[index] = node
                }),
                styles.point,
              ]}
            />
          </button>
        ))}
      </div>
      <div aria-hidden="true" mix={styles.days}>
        {days.map((day) => (
          <span key={day.label}>{day.label}</span>
        ))}
      </div>
      <div
        data-readout
        aria-hidden="true"
        inert
        mix={[
          ref((node, signal) => {
            surface = node
            let point = points[selected]
            if (point)
              cleanup = anchor(node, point, {
                placement: 'top',
                offset: 10,
              })
            signal.addEventListener(
              'abort',
              () => {
                cleanup()
                surface = undefined
              },
              {
                once: true,
              },
            )
          }),
          styles.bubble,
        ]}
      >
        <span>{days[selected].label}</span>
        <strong>{days[selected].visits.toLocaleString('en-US')}</strong>
      </div>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',
    '--muted': 'light-dark(#62626c, #b0b0bb)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '360px',
    maxWidth: '100%',
    padding: '12px 14px',
    color: 'var(--text)',
    font: '13px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  heading: css({
    fontWeight: 600,
    marginBottom: '40px',
  }),

  plot: css({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    height: '144px',
    backgroundImage: 'linear-gradient(to top, light-dark(#e4e4eb, #33333b) 1px, transparent 1px)',
    backgroundSize: '100% 48px',
    '& > svg': {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      color: 'light-dark(#62626c, #b0b0bb)',
    },
  }),

  day: css({
    position: 'relative',
    padding: 0,
    border: 0,
    background: 'transparent',
    cursor: 'crosshair',
    outline: 'none',
    '&[aria-pressed="true"] [data-point]': {
      boxShadow: '0 0 0 3px light-dark(#62626c33, #b0b0bb33)',
    },
    '&:focus-visible [data-point]': {
      outline: '2px solid light-dark(#62626c, #b0b0bb)',
      outlineOffset: '4px',
    },
  }),

  point: css({
    position: 'absolute',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '9px',
    height: '9px',
    border: '2px solid light-dark(#f9f9fb, #1b1b20)',
    borderRadius: '50%',
    background: 'light-dark(#62626c, #b0b0bb)',
    pointerEvents: 'none',
  }),

  days: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    marginTop: '12px',
    color: 'var(--muted)',
    textAlign: 'center',
    fontSize: '11px',
  }),

  bubble: css({
    visibility: 'hidden',
    colorScheme: 'light dark',
    margin: 0,
    padding: '7px 10px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '7px',
    background: 'light-dark(#fff, #25252b)',
    color: 'var(--text)',
    boxShadow: '0 4px 12px #00000016',
    font: '12px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    pointerEvents: 'none',
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    '& span': {
      color: 'var(--muted)',
    },
    '& strong': {
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
    },
  }),
}

function ChartLine() {
  return () => (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 700 100"
      preserveAspectRatio="none"
    >
      <polyline
        points={days
          .map((day, index) => `${index * 100 + 50},${100 - (day.visits / 2000) * 100}`)
          .join(' ')}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

const days = [
  { label: 'Mon', visits: 840 },
  { label: 'Tue', visits: 1120 },
  { label: 'Wed', visits: 980 },
  { label: 'Thu', visits: 1480 },
  { label: 'Fri', visits: 1260 },
  { label: 'Sat', visits: 1640 },
  { label: 'Sun', visits: 1520 },
]
