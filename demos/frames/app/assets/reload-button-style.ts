import { css } from 'remix/ui'

export const reloadButtonStyle = css({
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e9eefc',
  cursor: 'pointer',
  '&:hover': { background: 'rgba(255,255,255,0.10)' },
})
