import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { anchor } from '@remix-run/ui/anchor'

export default function Example(handle: Handle) {
  let selected = 3
  let surface: HTMLElement | undefined
  let cleanup = () => {}

  function selectPoint(point: HTMLElement, index: number) {
    if (selected === index) return
    let target = point.querySelector<HTMLElement>('[data-point]')
    if (!target) return
    selected = index
    cleanup()
    if (surface) cleanup = anchor(surface, target, { placement: 'top', offset: 10 })
    handle.update()
  }

  return () => (
    <div mix={chartCss}>
      <div mix={headingCss}>Visits</div>
      <div role="group" aria-label="Daily visits" mix={plotCss}>
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
              dayCss,
              on('pointerenter', (event) => {
                selectPoint(event.currentTarget, index)
              }),
              on('focus', (event) => selectPoint(event.currentTarget, index)),
              on('click', (event) => selectPoint(event.currentTarget, index)),
              on('keydown', (event) => {
                let next = index
                if (event.key === 'ArrowRight') next = Math.min(days.length - 1, index + 1)
                else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
                else if (event.key === 'Home') next = 0
                else if (event.key === 'End') next = days.length - 1
                else return
                event.preventDefault()
                event.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)
                  ?.focus()
              }),
            ]}
          >
            <span
              data-point
              aria-hidden="true"
              mix={[pointCss, css({ top: `${100 - (day.visits / 2000) * 100}%` })]}
            />
          </button>
        ))}
      </div>
      <div aria-hidden="true" mix={daysCss}>
        {days.map((day) => (
          <span key={day.label}>{day.label}</span>
        ))}
      </div>
      <div
        popover="manual"
        aria-hidden="true"
        inert
        mix={[
          bubbleCss,
          ref((node, signal) => {
            surface = node
            node.showPopover()
            let point = node.parentElement?.querySelector<HTMLElement>(
              `[data-day="${selected}"] [data-point]`,
            )
            if (point) cleanup = anchor(node, point, { placement: 'top', offset: 10 })
            let observer = new IntersectionObserver(
              ([entry]) => {
                node.style.visibility = entry.intersectionRatio === 1 ? 'visible' : 'hidden'
              },
              { threshold: 1 },
            )
            if (node.parentElement) observer.observe(node.parentElement)
            signal.addEventListener(
              'abort',
              () => {
                cleanup()
                observer.disconnect()
                surface = undefined
              },
              { once: true },
            )
          }),
        ]}
      >
        <span>{days[selected].label}</span>
        <strong>{days[selected].visits.toLocaleString('en-US')}</strong>
      </div>
    </div>
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

const chartCss = css({
  colorScheme: 'light dark',
  width: '360px',
  maxWidth: '100%',
  padding: '12px 14px',
  boxSizing: 'border-box',
  color: 'light-dark(#202027, #eeeef2)',
  font: '13px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})
const headingCss = css({ fontWeight: 600, marginBottom: '40px' })
const plotCss = css({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  height: '144px',
  backgroundImage: 'linear-gradient(to top, light-dark(#e4e4eb, #33333b) 1px, transparent 1px)',
  backgroundSize: '100% 48px',
  '& > svg': { position: 'absolute', inset: 0, pointerEvents: 'none' },
})
const dayCss = css({
  position: 'relative',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'crosshair',
  outline: 'none',
  '&[aria-pressed="true"] [data-point]': { boxShadow: '0 0 0 3px #8a78ed33' },
  '&:focus-visible [data-point]': { outline: '2px solid #8a78ed', outlineOffset: '4px' },
})
const pointCss = css({
  position: 'absolute',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  boxSizing: 'border-box',
  width: '9px',
  height: '9px',
  border: '2px solid light-dark(#f9f9fb, #1b1b20)',
  borderRadius: '50%',
  background: '#8a78ed',
  pointerEvents: 'none',
})
const daysCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  marginTop: '12px',
  color: 'light-dark(#62626c, #b0b0bb)',
  textAlign: 'center',
  fontSize: '11px',
})
const bubbleCss = css({
  visibility: 'hidden',
  colorScheme: 'light dark',
  margin: 0,
  padding: '7px 10px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '7px',
  background: 'light-dark(#fff, #25252b)',
  color: 'light-dark(#202027, #eeeef2)',
  boxShadow: '0 4px 12px #00000016',
  font: '12px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  pointerEvents: 'none',
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  '& span': { color: 'light-dark(#62626c, #b0b0bb)' },
  '& strong': { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
})

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
        stroke="#8a78ed"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
