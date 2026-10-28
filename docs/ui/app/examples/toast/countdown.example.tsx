import * as toast from '@remix-run/ui/toast'
import {
  animateEntrance,
  animateExit,
  animateLayout,
  prefersReducedMotion,
  drag,
  onDragStart,
  onDrag,
  onDragEnd,
} from '@remix-run/ui/animation'
import { css, on, createMixin } from 'remix/component'
import type { ElementProps } from 'remix/component'

const toastManager = toast.createToastManager({ defaultTimeout: 5000 })

export default function ExampleToastCountdown() {
  return () => (
    <div mix={[styles.root, styles.triggers]}>
      {(['bar', 'ring'] as const).map((treatment) => (
        <button
          type="button"
          mix={[
            styles.button,
            on('click', () => {
              toastManager.add({
                id: treatment,
                title: 'Toast title',
                description: 'This is a toast description.',
              })
            }),
          ]}
        >
          {treatment === 'bar' ? 'Bar' : 'Ring'}
        </button>
      ))}
    </div>
  )
}

export function ToastRegion() {
  return () => (
    <toast.Context manager={toastManager} limit={3}>
      {(toastItems) => (
        <section
          mix={[toast.root({ label: 'Notifications', hotkey: false }), styles.root, styles.region]}
        >
          {toastItems.map((toastItem, index) => (
            <toast.ItemContext key={toastItem.id} value={toastItem.id}>
              <article
                key={toastItem.id}
                data-toast-index={index}
                style={{ '--toast-index': index }}
                mix={[
                  toast.item({ countdown: true }),
                  styles.toastLayout,
                  swipeToDismiss(toastItem.id),
                  animateLayout(
                    prefersReducedMotion()
                      ? false
                      : {
                          duration: 160,
                          easing: 'ease-out',
                        },
                  ),
                  animateEntrance({
                    translate: '0 calc(100% + max(16px, env(safe-area-inset-bottom)))',
                    duration: prefersReducedMotion() ? 0 : 160,
                    easing: 'ease-out',
                  }),
                  animateExit({
                    position: index === 0 ? 'absolute' : 'var(--stack-position)',
                    zIndex: index === 0 ? 101 : 100 - index,
                    opacity: 0,
                    gridTemplateRows: '0fr',
                    marginBlockStart: 0,
                    translate: 'calc(100% + 24px) 0',
                    duration: prefersReducedMotion() ? 0 : 140,
                    transition: {
                      position: {
                        duration: 0,
                      },
                      zIndex: {
                        duration: 0,
                      },
                    },
                  }),
                ]}
              >
                <div mix={styles.collapseSlot}>
                  <div mix={[styles.surface]}>
                    {Boolean(toastItem.timeout) && toastItem.id !== 'bar' && (
                      <div aria-hidden="true" mix={[styles.timer, styles.hideWhenCovered]}>
                        <svg width="28" height="28" viewBox="0 0 28 28">
                          <circle cx="14" cy="14" r="11" mix={styles.ringTrack} />
                          <circle cx="14" cy="14" r="11" pathLength="100" mix={styles.ring} />
                        </svg>
                      </div>
                    )}
                    <div mix={[styles.message, styles.hideWhenCovered]}>
                      <strong mix={[toast.title(), styles.title]}>{toastItem.title}</strong>
                      <span mix={[toast.description(), styles.description]}>
                        {toastItem.description}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      mix={[styles.dismissButton, styles.hideWhenCovered, toast.close()]}
                    >
                      ×
                    </button>
                    {Boolean(toastItem.timeout) && toastItem.id === 'bar' && (
                      <div aria-hidden="true" mix={[styles.bar, styles.hideWhenCovered]} />
                    )}
                  </div>
                </div>
              </article>
            </toast.ItemContext>
          ))}
        </section>
      )}
    </toast.Context>
  )
}

const swipeToDismiss = createMixin<HTMLElement, [id: string], ElementProps>(() => {
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

  return (id) => [
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
      toastManager.close(id)
    }),
  ]
})

const styles = {
  hideWhenCovered: css({
    opacity: 'clamp(0, max(var(--stack-expanded), calc(1 - var(--toast-index))), 1)',
    visibility: 'var(--stack-content-visibility)',
    transition: 'opacity 90ms ease-out',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),
  root: css({
    colorScheme: 'light dark',
    maxWidth: '100%',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    '--toast-border': 'light-dark(#dedee5, #41414a)',
    '--toast-surface': 'light-dark(#fff, #222228)',
    '&, & *': {
      boxSizing: 'border-box',
    },
  }),
  triggers: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  }),
  title: css({
    display: 'block',
    fontSize: '13px',
  }),

  description: css({
    display: 'block',
    margin: '4px 0 0',
    fontSize: '12px',
    color: 'light-dark(#62626c, #b0b0bb)',
  }),
  button: css({
    appearance: 'none',
    flexShrink: 0,
    font: 'inherit',
    color: 'inherit',
    background: 'var(--toast-surface)',
    border: '1px solid var(--toast-border)',
    borderRadius: '6px',
    padding: '7px 12px',
    cursor: 'pointer',
    '&:hover': {
      background: 'light-dark(#f0f0f5, #34343d)',
    },
    '&:focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '3px',
    },
  }),
  region: css({
    position: 'fixed',
    insetInlineEnd: '16px',
    bottom: 'max(16px, env(safe-area-inset-bottom))',
    width: 'min(380px, calc(100vw - 32px))',
    display: 'flex',
    flexDirection: 'column-reverse',
    colorScheme: 'light dark',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.5 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    pointerEvents: 'auto',
    '--stack-expanded': 1,
    '--stack-gap': '12px',
    '--stack-position': 'relative',
    '--stack-height': 'auto',
    '--stack-overflow': 'visible',
    '--stack-content-visibility': 'visible',
    '&:not([data-expanded])': {
      '--stack-expanded': 0,
      '--stack-gap': '0px',
      '--stack-position': 'absolute',
      '--stack-height': '100%',
      '--stack-overflow': 'hidden',
      '--stack-content-visibility': 'hidden',
    },
    '&, & *': {
      boxSizing: 'border-box',
    },
  }),
  toastLayout: css({
    position: 'var(--stack-position)',
    height: 'var(--stack-height)',
    bottom: 'calc(var(--toast-index) * 14px * (1 - var(--stack-expanded)))',
    insetInline: 0,
    alignSelf: 'end',
    zIndex: 'calc(100 - var(--toast-index))',
    display: 'grid',
    gridTemplateRows: '1fr',
    alignContent: 'end',
    marginBlockStart: 'var(--stack-gap)',
    flexShrink: 0,
    width: '100%',
    transition:
      'grid-template-rows 140ms ease-out, margin-block-start 140ms ease-out, opacity 120ms ease-out',
    '&[data-toast-index="0"]': {
      position: 'relative',
      '--stack-height': 'auto',
      '--stack-overflow': 'visible',
      '--stack-content-visibility': 'visible',
    },
    '&[data-limited]': {
      gridTemplateRows: '0fr',
      marginBlockStart: 0,
      opacity: 0,
      pointerEvents: 'none',
    },
    '&:focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '3px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  collapseSlot: css({
    // Keep the surface full-sized while its grid row collapses.
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  }),
  surface: css({
    position: 'relative',
    height: 'var(--stack-height)',
    overflow: 'var(--stack-overflow)',
    scale: 'max(0.82, calc(1 - var(--toast-index) * 0.055 * (1 - var(--stack-expanded))))',
    opacity: 'max(0.5, calc(1 - var(--toast-index) * 0.12 * (1 - var(--stack-expanded))))',
    flexShrink: 0,
    transformOrigin: 'bottom center',
    transition: 'scale 160ms ease-out, opacity 120ms ease-out',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '17px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #222228)',
    boxShadow: '0 8px 28px #00000012, 0 2px 6px #00000008',
    '&::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      top: '100%',
      height: '13px',
    },
  }),
  message: css({
    flex: 1,
    minWidth: 0,
  }),
  dismissButton: css({
    appearance: 'none',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: '28px',
    height: '28px',
    margin: '0 -5px 0 0',
    border: 0,
    borderRadius: '5px',
    background: 'none',
    color: 'light-dark(#777780, #a2a2ad)',
    font: '20px/1 ui-sans-serif, system-ui, sans-serif',
    cursor: 'pointer',
    '&:hover': {
      background: 'light-dark(#f0f0f5, #34343d)',
    },
    '&:focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '2px',
    },
  }),
  timer: css({
    flexShrink: 0,
    width: '28px',
    height: '28px',
    color: 'light-dark(#777782, #a0a0ac)',
  }),
  ringTrack: css({
    fill: 'none',
    stroke: 'var(--toast-border)',
    strokeWidth: 2.5,
  }),
  ring: css({
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeDasharray: '100',
    strokeDashoffset: 'calc((var(--toast-countdown, 1) - 1) * 100px)',
    transform: 'rotate(-90deg)',
    transformOrigin: 'center',
  }),
  bar: css({
    transform: 'scaleX(var(--toast-countdown, 1))',
    transformOrigin: 'left',
    borderRadius: '0 0 12px 12px',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'light-dark(#777782, #a0a0ac)',
  }),
}
