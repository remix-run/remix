import { css } from 'remix/ui'

const accentColor = '#b9c6ff'
const mutedColor = '#9aa8e8'

export const linkStyle = css({ color: accentColor, textDecoration: 'underline' })

export const pageHeadingStyle = css({
  marginTop: 16,
  marginBottom: 8,
  letterSpacing: '-0.02em',
})

export const sectionHeadingStyle = css({ marginTop: 0, fontSize: 16 })

export const leadStyle = css({ marginTop: 0, color: accentColor })

export const mutedStyle = css({ color: mutedColor })

export const panelStyle = css({
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: 16,
  background: 'rgba(255,255,255,0.04)',
})

export const clockLabelStyle = css({ fontSize: 13, color: accentColor })
