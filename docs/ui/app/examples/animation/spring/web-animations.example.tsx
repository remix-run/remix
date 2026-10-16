import { prefersReducedMotion, spring } from '@remix-run/ui/animation'
import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleSpring(handle: Handle) {
  let enabled = false
  let thumb: HTMLSpanElement | undefined
  let animation: Animation | undefined
  return () => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      mix={[
        on('click', async () => {
          if (!thumb) return
          let from = getComputedStyle(thumb).transform
          animation?.cancel()
          enabled = !enabled
          let to = enabled ? 'translateX(24px)' : 'translateX(0)'
          await handle.update()
          if (!thumb) return
          if (!prefersReducedMotion()) {
            animation = thumb.animate(
              [
                {
                  transform: from,
                },
                {
                  transform: to,
                },
              ],
              spring('bouncy'),
            )
          }
        }),
        styles.button,
      ]}
    >
      Notifications
      <span aria-hidden="true" data-enabled={enabled} mix={styles.track}>
        <span
          data-enabled={enabled}
          mix={[
            ref((node: HTMLSpanElement, signal) => {
              thumb = node
              signal.addEventListener(
                'abort',
                () => {
                  animation?.cancel()
                  thumb = undefined
                },
                {
                  once: true,
                },
              )
            }),
            styles.thumb,
          ]}
        />
      </span>
    </button>
  )
}

const styles = {
  button: css({
    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '32px',
    width: '280px',
    maxWidth: '100%',
    padding: '18px 20px',
    border: '1px solid light-dark(#e0e0e6, #393940)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover': {
      background: 'light-dark(#f7f7fa, #24242b)',
    },
    '&:focus-visible': {
      outline: `2px solid light-dark(#70707c, #a0a0ac)`,
      outlineOffset: '3px',
    },
  }),

  track: css({
    display: 'block',
    width: '56px',
    height: '32px',
    padding: '4px',
    flexShrink: 0,
    borderRadius: '999px',
    background: 'light-dark(#d8d8df, #44444c)',
    '&[data-enabled="true"]': {
      background: 'light-dark(#62626c, #b0b0bb)',
    },
  }),

  thumb: css({
    display: 'block',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px #00000030',
    transform: 'translateX(0)',
    '&[data-enabled="true"]': {
      transform: 'translateX(24px)',
    },
  }),
}
