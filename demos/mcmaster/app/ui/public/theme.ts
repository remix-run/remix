import { css } from 'remix/component'

export const colors = {
  text: '#1f2328',
  muted: '#5c6670',
  border: '#d9dde1',
  subtle: '#f4f5f6',
  link: '#0b57b0',
  brand: '#ffd200',
  accent: '#1d7a46',
  danger: '#b42318',
}

export const fontStack =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji"'

export const linkStyle = css({
  color: colors.link,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})

export const headingStyle = css({
  margin: '0 0 0.75rem',
  fontSize: '1.5rem',
  fontWeight: 600,
  letterSpacing: '-0.01em',
})

export const buttonStyle = css({
  appearance: 'none',
  border: `1px solid ${colors.text}`,
  borderRadius: '3px',
  padding: '0.35rem 0.8rem',
  backgroundColor: colors.text,
  color: '#fff',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:disabled': { opacity: 0.6, cursor: 'progress' },
})

export const secondaryButtonStyle = css({
  appearance: 'none',
  border: `1px solid ${colors.border}`,
  borderRadius: '3px',
  padding: '0.3rem 0.7rem',
  backgroundColor: '#fff',
  color: colors.text,
  font: 'inherit',
  cursor: 'pointer',
  '&:hover': { borderColor: colors.muted },
})

export const inputStyle = css({
  border: `1px solid ${colors.border}`,
  borderRadius: '3px',
  padding: '0.3rem 0.4rem',
  font: 'inherit',
  width: '4.5rem',
})
