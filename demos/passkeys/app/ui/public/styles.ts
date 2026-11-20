import { css } from 'remix/component'

// Colors come from the custom properties declared in `ui/document.tsx`, which switch for dark mode.

export const page = css({
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '1.5rem',
})

export const stack = css({
  width: '100%',
  maxWidth: '28rem',
  display: 'grid',
  gap: '1.5rem',
})

export const card = css({
  display: 'grid',
  gap: '1rem',
  padding: '2rem',
  borderRadius: '0.75rem',
  background: 'var(--surface)',
  boxShadow: '0 10px 30px -12px rgb(0 0 0 / 0.25)',
})

export const heading = css({
  fontSize: '1.5rem',
  fontWeight: 600,
  lineHeight: 1.2,
})

export const subheading = css({
  fontSize: '1.125rem',
  fontWeight: 600,
})

export const muted = css({
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
})

export const form = css({
  display: 'grid',
  gap: '0.75rem',
})

export const field = css({
  display: 'grid',
  gap: '0.375rem',
})

export const label = css({
  fontSize: '0.875rem',
  fontWeight: 500,
})

export const input = css({
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  background: 'var(--surface)',
  color: 'inherit',
  '&:focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '1px',
  },
})

export const primaryButton = css({
  width: '100%',
  padding: '0.625rem 1rem',
  border: 'none',
  borderRadius: '0.5rem',
  background: 'var(--accent)',
  color: 'var(--accent-text)',
  fontWeight: 500,
  cursor: 'pointer',
  '&:hover:not(:disabled)': {
    background: 'var(--accent-hover)',
  },
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '2px',
  },
})

export const secondaryButton = css({
  padding: '0.5rem 0.875rem',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  background: 'transparent',
  color: 'inherit',
  fontWeight: 500,
  cursor: 'pointer',
  '&:hover:not(:disabled)': {
    background: 'var(--surface-hover)',
  },
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '2px',
  },
})

export const errorMessage = css({
  padding: '0.625rem 0.75rem',
  borderRadius: '0.5rem',
  background: 'var(--error-surface)',
  color: 'var(--error-text)',
  fontSize: '0.875rem',
})

export const successMessage = css({
  padding: '0.625rem 0.75rem',
  borderRadius: '0.5rem',
  background: 'var(--success-surface)',
  color: 'var(--success-text)',
  fontSize: '0.875rem',
})
