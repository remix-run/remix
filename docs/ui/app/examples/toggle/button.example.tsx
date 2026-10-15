import { css } from 'remix/component'
import * as toggle from '@remix-run/ui/toggle'

export default function Example() {
  return () => (
    <div mix={stackCss}>
      <label mix={[cardCss, rowCss]}>
        <strong>Do not disturb</strong>
        <button type="button" mix={[switchCss, toggle.toggle({})]} />
      </label>
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
  cursor: 'pointer',
  transition: 'background-color 120ms ease, border-color 120ms ease',
  '@media (hover: hover)': {
    '&:hover': {
      background: 'light-dark(#f7f7fa, #24242b)',
      borderColor: 'light-dark(#bcbcc7, #5b5b68)',
    },
  },
  '&:active, &:has(button:active), &:has(input:active)': {
    background: 'light-dark(#eeeef3, #303038)',
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

const rowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
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
