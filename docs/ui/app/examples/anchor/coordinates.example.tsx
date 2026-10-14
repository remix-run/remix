import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import * as anchor from '@remix-run/ui/anchor'
export default function Example(handle: Handle) {
  let target: anchor.AnchorTarget | undefined
  let surface: HTMLElement | undefined
  let cleanup = () => {}
  let note = ''
  return () => (
    <div mix={stackCss}>
      <button
        type="button"
        mix={[
          cardCss,
          on('click', (event) => {
            let rect = event.currentTarget.getBoundingClientRect()
            target =
              event.detail === 0
                ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                : { x: event.clientX, y: event.clientY }
            surface?.showPopover()
          }),
        ]}
      >
        <strong>Project brief</strong>
        <span mix={mutedCss}>{note || 'Click or tap to add an annotation'}</span>
      </button>
      <div
        id={`${handle.id}-surface`}
        popover="auto"
        mix={[
          surfaceCss,
          ref((node: HTMLElement, signal) => {
            surface = node
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
        <form
          mix={[
            annotationCss,
            on('submit', (event) => {
              event.preventDefault()
              let data = new FormData(event.currentTarget)
              note = String(data.get('note') ?? '')
              surface?.hidePopover()
              handle.update()
            }),
          ]}
        >
          <label for={`${handle.id}-note`}>Annotation</label>
          <input
            id={`${handle.id}-note`}
            name="note"
            defaultValue={note}
            required
            autofocus
            placeholder="Add a note"
            mix={inputCss}
          />
          <button type="submit" mix={saveCss}>
            Save annotation
          </button>
        </form>
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

const cardCss = css({
  padding: '20px',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'crosshair',
  '&:hover': { background: 'light-dark(#f8f8fa, #25252b)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
  display: 'grid',
  gap: '16px',
})

const mutedCss = css({ margin: 0, fontSize: '12px', color: 'light-dark(#62626c, #b0b0bb)' })

const inputCss = css({
  boxSizing: 'border-box',
  width: '100%',
  padding: '10px 12px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'inherit',
  font: 'inherit',
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '2px' },
  '&:disabled': { opacity: 0.45 },
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

const annotationCss = css({ display: 'grid', gap: '8px', padding: '10px' })

const saveCss = css({
  padding: '8px 12px',
  border: 0,
  borderRadius: '6px',
  background: 'light-dark(#202027, #eeeef2)',
  color: 'light-dark(#fff, #202027)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
})
