import { css } from 'remix/component'

const buttonBaseCss = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  margin: 0,
  border: '1px solid transparent',
  borderRadius: '999px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textDecoration: 'none',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: '2px solid var(--rmx-color-focus-ring)',
    outlineOffset: '2px',
  },
})

const ghostButtonCss = css({
  '&:hover, &:focus-visible': {
    background: 'var(--docs-nav-hover-background)',
  },
})

export const button = {
  ghost: [buttonBaseCss, ghostButtonCss],
} as const
