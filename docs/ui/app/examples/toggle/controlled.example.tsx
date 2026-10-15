import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as toggle from '@remix-run/ui/toggle'

export default function Example(handle: Handle) {
  let showPassword = false
  let password = 'remix-ui-demo'
  return () => (
    <div mix={stackCss}>
      <div mix={cardCss}>
        <label mix={fieldCss}>
          <strong>Password</strong>
          <input
            {...(showPassword ? { type: 'text' } : { type: 'password' })}
            autocomplete="off"
            value={password}
            mix={[
              inputCss,
              on('input', (event) => {
                password = event.currentTarget.value
                handle.update()
              }),
            ]}
          />
        </label>
        <label mix={rowCss}>
          <span>Show password</span>
          <input
            type="checkbox"
            mix={[
              switchCss,
              toggle.toggle({
                checked: showPassword,
                onCheckedChange(next) {
                  showPassword = next
                  handle.update()
                },
              }),
            ]}
          />
        </label>
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
  border: '1px solid light-dark(#e0e0e6, #393940)',
  borderRadius: '12px',
  background: 'light-dark(#fff, #1b1b20)',
  display: 'grid',
  gap: '16px',
})

const rowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '8px',
  margin: '-8px',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'background-color 120ms ease',
  '@media (hover: hover)': {
    '&:hover': { background: 'light-dark(#f7f7fa, #24242b)' },
  },
  '&:active, &:has(input:active)': { background: 'light-dark(#eeeef3, #303038)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

const fieldCss = css({ display: 'grid', gap: '8px' })

const inputCss = css({
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  padding: '10px 12px',
  border: '1px solid light-dark(#c9c9d2, #494951)',
  borderRadius: '6px',
  background: 'light-dark(#fff, #24242b)',
  color: 'inherit',
  font: 'inherit',
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
})

const switchCss = css({
  appearance: 'none',
  flexShrink: 0,
  width: '44px',
  height: '26px',
  margin: 0,
  padding: '3px',
  border: '1px solid light-dark(#c9c9d2, #494951)',
  borderRadius: '20px',
  background: 'light-dark(#e2e2e8, #393940)',
  cursor: 'pointer',
  transition: 'background-color 160ms ease',
  '&::after': {
    content: '""',
    display: 'block',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px #00000030',
    transition: 'transform 160ms ease',
  },
  '&[data-state="checked"]': {
    background: 'light-dark(#0578be, #318ece)',
    borderColor: 'transparent',
  },
  '&[data-state="checked"]::after': { transform: 'translateX(18px)' },
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '3px' },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&::after': { transition: 'none' },
  },
})
