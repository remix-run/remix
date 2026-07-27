import { css } from 'remix/ui'

// Shared visual tokens for the demo. Keep these in sync with `Document`.
const accentColor = '#b9c6ff'
const mutedColor = '#9aa8e8'
const textColor = '#e9eefc'

export const bodyStyle = css({
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
  margin: 0,
  padding: 24,
  background: '#0b1020',
  color: textColor,
})

export const containerStyle = css({ margin: '0 auto' })

export const linkStyle = css({ color: accentColor, textDecoration: 'underline' })

export const pageHeadingStyle = css({
  marginTop: 16,
  marginBottom: 8,
  letterSpacing: '-0.02em',
})

export const sectionHeadingStyle = css({ marginTop: 0, fontSize: 16 })

export const leadStyle = css({ marginTop: 0, color: accentColor })

export const mutedStyle = css({ color: mutedColor })

export const listStyle = css({ margin: 0, paddingLeft: 18, color: textColor })

export const panelStyle = css({
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: 16,
  background: 'rgba(255,255,255,0.04)',
})

export const fragmentStyle = css({
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10,
  padding: 10,
  background: 'rgba(255,255,255,0.02)',
})

export const nestedFragmentStyle = css({
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 8,
  padding: 8,
  background: 'rgba(255,255,255,0.02)',
})

export const fragmentLabelStyle = css({ fontSize: 12, color: accentColor })

export const nestedFrameLabelStyle = css({ fontSize: 12, color: mutedColor, marginBottom: 6 })

export const clockLabelStyle = css({ fontSize: 13, color: accentColor })

export const clockValueStyle = css({
  fontSize: 16,
  fontVariantNumeric: 'tabular-nums',
  marginTop: 2,
})

export const largeClockValueStyle = css({ fontSize: 18, fontVariantNumeric: 'tabular-nums' })
