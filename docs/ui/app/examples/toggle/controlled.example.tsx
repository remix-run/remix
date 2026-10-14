import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as toggle from '@remix-run/ui/toggle'

export default function Example(handle: Handle) {
  let paused = false
  return () => (
    <div mix={stackCss}>
      <div mix={cardCss}>
        <label mix={rowCss}>
          <strong>Pause notifications</strong>
          <input
            type="checkbox"
            mix={[
              switchCss,
              toggle.toggle({
                checked: paused,
                onCheckedChange(next) {
                  paused = next
                  handle.update()
                },
              }),
            ]}
          />
        </label>
        <button
          type="button"
          disabled={!paused}
          mix={[
            buttonCss,
            on('click', () => {
              paused = false
              handle.update()
            }),
          ]}
        >
          Resume notifications
        </button>
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
  '&[aria-disabled="true"], &:disabled': { opacity: 0.4, cursor: 'default' },
  '&[aria-readonly="true"], &[readonly]': { cursor: 'default' },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&::after': { transition: 'none' },
  },
})
