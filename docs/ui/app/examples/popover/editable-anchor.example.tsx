import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as popover from '@remix-run/ui/popover'

export default function Example(handle: Handle) {
  let open = false
  let color = '#5bb8ef'
  return () => (
    <div mix={stackCss}>
      <popover.Context>
        <label for={`${handle.id}-color`}>Accent color</label>
        <input
          id={`${handle.id}-color`}
          value={color}
          spellcheck={false}
          aria-describedby={`${handle.id}-preview`}
          mix={[
            inputCss,
            popover.anchor({ placement: 'bottom-start', offset: 8 }),
            on('focus', () => {
              open = true
              handle.update()
            }),
            on('input', (event) => {
              color = event.currentTarget.value
              open = true
              handle.update()
            }),
          ]}
        />
        <div
          id={`${handle.id}-preview`}
          mix={[
            surfaceCss,
            popover.surface({
              open,
              closeOnAnchorClick: false,
              restoreFocusOnHide: false,
              onHide() {
                open = false
                handle.update()
              },
            }),
          ]}
        >
          <div mix={previewCss}>
            <div
              aria-hidden="true"
              mix={[
                swatchCss,
                css({ backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : 'transparent' }),
              ]}
            />
            <span role="status" mix={mutedCss}>
              {/^#[0-9a-f]{6}$/i.test(color) ? 'Accent preview' : 'Enter a six-digit hex color'}
            </span>
          </div>
        </div>
      </popover.Context>
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

const previewCss = css({ display: 'grid', gap: '10px', padding: '10px' })
const swatchCss = css({
  height: '64px',
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '6px',
})
