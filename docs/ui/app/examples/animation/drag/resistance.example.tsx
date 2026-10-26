import {
  animateEntrance,
  animateExit,
  prefersReducedMotion,
  drag,
  onDragStart,
  onDrag,
  onDragEnd,
} from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleDragCard(handle: Handle) {
  let returning = false
  let turningPoint = 0

  function trackSwipe(offset: number) {
    if (returning) {
      turningPoint = Math.min(turningPoint, offset)
      if (offset - turningPoint > 40) {
        returning = false
        turningPoint = offset
      }
    } else {
      turningPoint = Math.max(turningPoint, offset)
      if (turningPoint - offset >= 10) {
        returning = true
        turningPoint = offset
      }
    }
  }

  let visible = true
  let reset: ReturnType<typeof setTimeout> | undefined
  handle.signal.addEventListener('abort', () => clearTimeout(reset), { once: true })

  function dismiss() {
    visible = false
    handle.update()
    reset = setTimeout(() => {
      visible = true
      handle.update()
    }, 450)
  }

  return () => (
    <div mix={styles.stage}>
      {visible && (
        <article
          key="card"
          aria-label="Swipe to dismiss card"
          mix={[
            styles.card,
            animateEntrance({
              translate: '0 calc(100% + 64px)',
              duration: prefersReducedMotion() ? 0 : 180,
              easing: 'ease-out',
            }),
            animateExit({
              opacity: 0,
              translate: '100% 0',
              duration: prefersReducedMotion() ? 0 : 140,
              easing: 'ease-out',
            }),
            drag({
              snapToOrigin: true,
              axis: 'x',
              constraints: { left: 0 },
              elasticity: 0.1,
            }),
            onDragStart(() => {
              returning = false
              turningPoint = 0
            }),
            onDrag((event) => trackSwipe(event.offset.x)),
            onDragEnd((event) => {
              if (event.cancelled) return
              trackSwipe(event.offset.x)
              if (returning || event.offset.x <= 40) return
              event.preventDefault()
              dismiss()
            }),
          ]}
        >
          <span mix={styles.handle} aria-hidden="true">
            ⠿
          </span>
          <div>
            <strong>Changes saved</strong>
            <p mix={styles.description}>Your workspace is up to date.</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss card"
            mix={[styles.dismiss, on('click', dismiss)]}
          >
            ×
          </button>
        </article>
      )}
    </div>
  )
}

const styles = {
  stage: css({
    minHeight: '184px',
    overflow: 'clip',
    boxSizing: 'border-box',
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    paddingBlock: '24px',
  }),
  card: css({
    colorScheme: 'light dark',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    maxWidth: '300px',
    padding: '20px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '12px',
    color: 'light-dark(#202027, #eeeef2)',
    background: 'light-dark(#fff, #222228)',
    font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
    boxShadow: '0 8px 28px #00000012, 0 2px 6px #00000008',
    cursor: 'grab',
    '&[data-dragging]': {
      cursor: 'grabbing',
    },
  }),
  dismiss: css({
    alignSelf: 'center',
    flexShrink: 0,
    border: 0,
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: '20px',
    lineHeight: 1,
    padding: '4px',
    cursor: 'pointer',
  }),
  handle: css({
    color: 'light-dark(#777780, #a2a2ad)',
    fontSize: '24px',
  }),
  description: css({
    margin: '4px 0 0',
    color: 'light-dark(#62626c, #b0b0bb)',
  }),
}
