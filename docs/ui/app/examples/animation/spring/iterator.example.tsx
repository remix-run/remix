import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { prefersReducedMotion, spring } from '@remix-run/ui/animation'

export default function Example(handle: Handle) {
  let active = 0
  let position = 0
  let frame = 0

  function goTo(index: number) {
    cancelAnimationFrame(frame)
    active = index
    let from = position
    let to = active * 100
    if (prefersReducedMotion()) {
      position = to
      handle.update()
      return
    }
    let samples = spring('smooth')
    function tick() {
      let sample = samples.next()
      position = sample.done ? to : from + (to - from) * sample.value
      handle.update()
      if (!sample.done) frame = requestAnimationFrame(tick)
    }
    handle.update()
    frame = requestAnimationFrame(tick)
  }

  return () => (
    <div
      mix={[
        panelCss,
        ref((node, signal) => {
          signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true })
        }),
      ]}
    >
      <div
        mix={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        })}
      >
        <strong>Highlights</strong>
        <div mix={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
          <span mix={mutedCss}>
            {active + 1} / {slides.length}
          </span>
          <button
            type="button"
            aria-label="Previous slide"
            disabled={active === 0}
            mix={[
              buttonCss,
              css({ padding: '8px', '&:disabled': { opacity: 0.4, cursor: 'not-allowed' } }),
              on('click', () => goTo(active - 1)),
            ]}
          >
            <Arrow back />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            disabled={active === slides.length - 1}
            mix={[
              buttonCss,
              css({ padding: '8px', '&:disabled': { opacity: 0.4, cursor: 'not-allowed' } }),
              on('click', () => goTo(active + 1)),
            ]}
          >
            <Arrow />
          </button>
        </div>
      </div>
      <div
        mix={css({
          overflow: 'hidden',
          borderRadius: '12px',
          border: '1px solid light-dark(#e0e0e6, #393940)',
        })}
      >
        <div mix={css({ display: 'flex', transform: `translateX(-${position}%)` })}>
          {slides.map((slide, index) => (
            <div
              key={slide.title}
              aria-hidden={active !== index}
              inert={active !== index}
              mix={css({
                flex: '0 0 100%',
                minWidth: 0,
                padding: '24px',
                background: 'light-dark(#fff, #1b1b20)',
              })}
            >
              <strong>{slide.title}</strong>
              <p mix={mutedCss}>{slide.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
const slides = [
  {
    title: 'A place for every project',
    description: 'Keep designs, feedback and decisions together.',
  },
  {
    title: 'Stay in the loop',
    description: 'Follow updates from the people you work with.',
  },
  {
    title: 'Make room for good work',
    description: 'Turn your next idea into something worth sharing.',
  },
]

const panelCss = css({
  colorScheme: 'light dark',
  width: '28rem',
  maxWidth: '100%',
  display: 'grid',
  gap: '20px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})
const buttonCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '9px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 160ms ease, color 160ms ease',
  '&:hover:not(:disabled)': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const mutedCss = css({ color: 'light-dark(#62626c, #b0b0bb)', margin: 0, fontSize: '12px' })

function Arrow(handle: Handle<{ back?: boolean }>) {
  return () => (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      mix={css({ transform: handle.props.back ? 'rotate(180deg)' : 'none' })}
    >
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
