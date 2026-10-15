import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { prefersReducedMotion, spring } from '@remix-run/ui/animation'

export default function Example(handle: Handle) {
  let enabled = false
  let thumb: HTMLSpanElement | undefined
  let animation: Animation | undefined
  return () => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      mix={[
        buttonCss,
        on('click', async () => {
          if (!thumb) return
          let from = getComputedStyle(thumb).transform
          animation?.cancel()
          enabled = !enabled
          let to = enabled ? 'translateX(24px)' : 'translateX(0)'
          await handle.update()
          if (!thumb) return
          if (!prefersReducedMotion()) {
            animation = thumb.animate([{ transform: from }, { transform: to }], {
              ...spring('bouncy'),
            })
          }
        }),
      ]}
    >
      Notifications
      <span
        aria-hidden="true"
        mix={css({
          display: 'block',
          width: '56px',
          height: '32px',
          padding: '4px',
          flexShrink: 0,
          borderRadius: '999px',
          background: enabled ? 'light-dark(#0578be, #5bb8ef)' : 'light-dark(#d8d8df, #44444c)',
        })}
      >
        <span
          mix={[
            css({
              display: 'block',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px #00000030',
              transform: enabled ? 'translateX(24px)' : 'translateX(0)',
            }),
            ref((node: HTMLSpanElement, signal) => {
              thumb = node
              signal.addEventListener(
                'abort',
                () => {
                  animation?.cancel()
                  thumb = undefined
                },
                { once: true },
              )
            }),
          ]}
        />
      </span>
    </button>
  )
}
const buttonCss = css({
  colorScheme: 'light dark',
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
  '&:hover': { background: 'light-dark(#f7f7fa, #24242b)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
})
