import { css } from '@remix-run/component'
import * as toggle from '@remix-run/ui/toggle'

/**
 * @name Toggle Primitives
 * @description Headless switch behavior for native inputs and custom controls.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={rootCss}>
      <label mix={optionCss}>
        <input
          mix={[nativeControlCss, toggle.control({ defaultChecked: true })]}
          name="notifications"
          type="checkbox"
        />
        Email notifications
      </label>

      <button mix={[customControlCss, toggle.control({})]} type="button">
        Desktop alerts
      </button>

      <button disabled mix={[customControlCss, toggle.control({})]} type="button">
        Weekly digest
      </button>
    </div>
  )
}

const rootCss = css({
  display: 'grid',
  gap: '12px',
  width: 'min(100%, 22rem)',
  color: 'light-dark(#151515, #ececec)',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 500,
  letterSpacing: 0,
})

const optionCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
})

const nativeControlCss = css({
  appearance: 'none',
  boxSizing: 'border-box',
  width: '32px',
  height: '18px',
  margin: 0,
  border: '1px solid light-dark(#b8b8b8, #666666)',
  borderRadius: '999px',
  background: 'light-dark(#e7e7e7, #333333)',
  padding: '2px',
  '&::after': {
    content: '""',
    display: 'block',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'light-dark(#ffffff, #ececec)',
    transition: 'translate 120ms ease',
  },
  '&:checked': {
    borderColor: 'light-dark(#3573f6, #6eaaff)',
    background: 'light-dark(#3573f6, #6eaaff)',
  },
  '&:checked::after': {
    translate: '14px 0',
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#3573f6, #6eaaff)',
    outlineOffset: '2px',
  },
})

const customControlCss = css({
  appearance: 'none',
  justifySelf: 'start',
  minHeight: '30px',
  border: '1px solid light-dark(#d1d1d1, #444444)',
  borderRadius: '6px',
  background: 'light-dark(#ffffff, #1a1a1a)',
  color: 'inherit',
  font: 'inherit',
  padding: '5px 10px',
  '&[data-state="checked"]': {
    borderColor: 'light-dark(#3573f6, #6eaaff)',
    background: 'light-dark(#e8f0ff, #243a64)',
  },
  '&:disabled': {
    opacity: 0.4,
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#3573f6, #6eaaff)',
    outlineOffset: '2px',
  },
})
