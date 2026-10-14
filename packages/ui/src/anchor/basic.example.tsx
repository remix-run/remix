import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import * as anchor from '@remix-run/ui/anchor'
export default function Example(handle: Handle) {
  let target: anchor.AnchorTarget | undefined
  let cleanup = () => {}
  return () => (
    <div mix={stackCss}>
      <button
        type="button"
        popovertarget={`${handle.id}-surface`}
        mix={[
          buttonCss,
          on('click', (event) => {
            target = event.currentTarget
          }),
        ]}
      >
        Project details
      </button>
      <div
        id={`${handle.id}-surface`}
        popover="auto"
        mix={[
          surfaceCss,
          ref((node: HTMLElement, signal) => {
            signal.addEventListener('abort', () => cleanup(), { once: true })
          }),
          on('beforetoggle', (event) => {
            cleanup()
            if (event.newState === 'open' && target)
              cleanup = anchor.anchor(event.currentTarget, target, {
                placement: 'bottom-start',
                offset: 8,
              })
          }),
        ]}
      >
        <div mix={bodyCss}>
          <strong>Website refresh</strong>
          <p mix={mutedCss}>Design review is ready. Due next week.</p>
        </div>
      </div>
    </div>
  )
}

const stackCss = css({
  colorScheme: 'light dark',
  width: '320px',
  maxWidth: '100%',
  display: 'grid',
  gap: '16px',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})

const mutedCss = css({ margin: 0, fontSize: '12px', color: 'light-dark(#62626c, #b0b0bb)' })

const buttonCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '9px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
  '&:disabled': { opacity: 0.45, cursor: 'default' },
})

const surfaceCss = css({
  colorScheme: 'light dark',
  boxSizing: 'border-box',
  margin: 0,
  padding: '6px',
  minWidth: '220px',
  maxWidth: 'calc(100vw - 32px)',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '10px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'light-dark(#202027, #eeeef2)',
  boxShadow: '0 12px 32px #00000024',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  opacity: 0,
  transition: 'opacity 140ms ease, display 140ms allow-discrete, overlay 140ms allow-discrete',
  '&:popover-open': { opacity: 1, '@starting-style': { opacity: 0 } },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

const bodyCss = css({ padding: '12px', width: '220px' })
