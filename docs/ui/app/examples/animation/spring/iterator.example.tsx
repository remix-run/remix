import { prefersReducedMotion, spring } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleSpring(handle: Handle) {
  let active = 0
  let position = 0
  let frame = 0
  handle.signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true })

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
    <div mix={styles.root}>
      <div mix={styles.header}>
        <strong>Highlights</strong>
        <div mix={styles.actions}>
          <span mix={styles.muted}>
            {active + 1} / {slides.length}
          </span>
          <button
            type="button"
            aria-label="Previous slide"
            disabled={active === 0}
            mix={[on('click', () => goTo(active - 1)), styles.button]}
          >
            <Arrow back />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            disabled={active === slides.length - 1}
            mix={[on('click', () => goTo(active + 1)), styles.button]}
          >
            <Arrow />
          </button>
        </div>
      </div>
      <div mix={styles.viewport}>
        <div
          mix={styles.track}
          style={{
            transform: `translateX(-${position}%)`,
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.title}
              aria-hidden={active !== index}
              inert={active !== index}
              mix={styles.slide}
            >
              <strong>{slide.title}</strong>
              <p mix={styles.muted}>{slide.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: css({
    '--surface': 'light-dark(#fff, #1b1b20)',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    width: '28rem',
    maxWidth: '100%',
    display: 'grid',
    gap: '20px',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  }),

  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }),

  muted: css({
    color: 'light-dark(#62626c, #b0b0bb)',
    margin: 0,
    fontSize: '12px',
  }),

  button: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'var(--surface)',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 160ms ease, color 160ms ease',
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '&:hover:not(:disabled)': {
      background: 'light-dark(#f0f0f5, #303038)',
    },
    '&:focus-visible': {
      outline: '2px solid light-dark(#70707c, #a0a0ac)',
      outlineOffset: '3px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  viewport: css({
    overflow: 'hidden',
    borderRadius: '12px',
    border: '1px solid light-dark(#e0e0e6, #393940)',
  }),

  track: css({
    display: 'flex',
  }),

  slide: css({
    flex: '0 0 100%',
    minWidth: 0,
    padding: '24px',
    background: 'var(--surface)',
  }),
}

function Arrow(handle: Handle<{ back?: boolean }>) {
  return () => (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      mix={css({
        transform: handle.props.back ? 'rotate(180deg)' : 'none',
      })}
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
