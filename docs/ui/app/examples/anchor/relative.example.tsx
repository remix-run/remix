import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import * as anchor from '@remix-run/ui/anchor'

export default function Example(handle: Handle) {
  let target: HTMLElement | undefined
  let cleanup = () => {}
  return () => (
    <div mix={stackCss}>
      <button
        type="button"
        popovertarget={`${handle.id}-surface`}
        mix={[
          buttonCss,
          triggerCss,
          on('click', (event) => {
            target = event.currentTarget.querySelector<HTMLElement>('[data-title]') ?? undefined
          }),
        ]}
      >
        <span data-title>Website refresh</span>
        <ExpandIcon />
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
                placement: 'top-start',
                inset: true,
                relativeTo: '[data-heading]',
              })
          }),
        ]}
      >
        <div mix={headingCss}>
          <strong data-heading>Website refresh</strong>
          <button
            type="button"
            aria-label="Close project details"
            autofocus
            popovertarget={`${handle.id}-surface`}
            popovertargetaction="hide"
            mix={[buttonCss, closeCss]}
          >
            <CloseIcon />
          </button>
        </div>
        <p mix={detailsCss}>Design review is ready. Due next week.</p>
        <span mix={statusCss}>In progress</span>
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
  padding: '16px',
  width: '300px',
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

const triggerCss = css({ width: 'fit-content', justifyContent: 'space-between', padding: '16px' })
const headingCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
})
const closeCss = css({ padding: '4px', border: 0, background: 'transparent' })
const detailsCss = css({ margin: '16px 0', color: 'light-dark(#62626c, #b0b0bb)' })
const statusCss = css({
  display: 'inline-block',
  padding: '3px 8px',
  borderRadius: '6px',
  background: 'light-dark(#eaf5fc, #173348)',
  color: 'light-dark(#0578be, #80caff)',
  fontSize: '12px',
})

function ExpandIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path
        d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
function CloseIcon() {
  return () => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
      <path
        d="m6 6 12 12M6 18 18 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  )
}
