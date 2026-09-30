import { css } from 'remix/component'

const baseStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  minHeight: '30px',
  paddingInline: '12px',
  borderRadius: '999px',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: '20px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: `2px solid #1a72ff`,
    outlineOffset: '2px',
  },
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
})

const neutralStyle = css({
  border: '1px solid #d1d1d1',
  background: '#fff',
  color: '#151515',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background: '#f8f8f8',
  },
})

const primaryStyle = css({
  border: 0,
  background: '#151515',
  color: '#fff',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background: '#303030',
  },
})

export function button(options: { tone?: 'neutral' | 'primary' } = {}) {
  return [baseStyle, options.tone === 'primary' ? primaryStyle : neutralStyle]
}
