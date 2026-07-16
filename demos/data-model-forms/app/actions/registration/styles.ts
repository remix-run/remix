import { css } from 'remix/ui'

const color = {
  canvas: '#f4f3ee',
  surface: '#ffffff',
  surfaceMuted: '#f8f8f5',
  text: '#20201e',
  textSecondary: '#5b5b54',
  textMuted: '#74746c',
  border: '#d9d8d0',
  borderStrong: '#bdbcb2',
  accent: '#166534',
  accentSoft: '#dcfce7',
  danger: '#b42318',
  dangerSoft: '#fff1ef',
} as const

export const body = css({
  minHeight: '100vh',
  margin: 0,
  background: color.canvas,
  color: color.text,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
})

export const page = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)',
  gap: 'clamp(2rem, 6vw, 5rem)',
  width: 'min(100% - 2rem, 70rem)',
  margin: '0 auto',
  paddingBlock: 'clamp(2rem, 7vw, 5rem)',
  '@media (max-width: 48rem)': {
    gridTemplateColumns: '1fr',
  },
})

export const intro = css({
  alignSelf: 'start',
  position: 'sticky',
  top: '3rem',
  '@media (max-width: 48rem)': {
    position: 'static',
  },
})

export const eyebrow = css({
  margin: 0,
  color: color.accent,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
})

export const heading = css({
  marginBlock: '0.75rem 1.25rem',
  fontSize: 'clamp(2.25rem, 6vw, 4.75rem)',
  letterSpacing: '-0.055em',
  lineHeight: 0.98,
})

export const lede = css({
  maxWidth: '40rem',
  margin: 0,
  color: color.textSecondary,
  fontSize: '1rem',
  lineHeight: 1.65,
})

export const featureList = css({
  display: 'grid',
  gap: '0.75rem',
  marginBlock: '2rem 0',
  paddingInlineStart: '1.25rem',
  color: color.textSecondary,
  fontSize: '0.875rem',
  lineHeight: 1.5,
})

export const panel = css({
  border: `1px solid ${color.border}`,
  borderRadius: '0.75rem',
  background: color.surface,
  boxShadow: '0 1rem 3rem rgb(32 32 30 / 0.08)',
  padding: 'clamp(1.25rem, 4vw, 2rem)',
})

export const workspace = css({
  display: 'grid',
  gap: '1.5rem',
})

export const panelHeader = css({
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: '1rem',
  paddingBlockEnd: '1.5rem',
  borderBlockEnd: `1px solid ${color.border}`,
  '@media (max-width: 32rem)': {
    alignItems: 'start',
    flexDirection: 'column',
  },
})

export const step = css({
  margin: 0,
  color: color.textMuted,
  fontSize: '0.75rem',
  fontWeight: 650,
  textTransform: 'uppercase',
})

export const panelHeading = css({
  marginBlock: '0.25rem 0',
  fontSize: '1.5rem',
  letterSpacing: '-0.025em',
})

export const requiredNote = css({
  maxWidth: '14rem',
  margin: 0,
  color: color.textMuted,
  fontSize: '0.75rem',
  lineHeight: 1.45,
})

export const form = css({
  display: 'grid',
  gap: '1.25rem',
  paddingBlockStart: '1.5rem',
})

export const fieldGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '1.25rem 1rem',
  '@media (max-width: 36rem)': {
    gridTemplateColumns: '1fr',
  },
})

export const field = css({
  display: 'grid',
  alignContent: 'start',
  gap: '0.5rem',
})

export const label = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
  color: color.text,
  fontSize: '0.875rem',
  fontWeight: 650,
})

export const required = css({
  color: color.textMuted,
  fontSize: '0.6875rem',
  fontWeight: 500,
})

export const optional = css({
  color: color.textMuted,
  fontSize: '0.6875rem',
  fontWeight: 500,
})

export const control = css({
  width: '100%',
})

export const fieldError = css({
  gridColumn: '1 / -1',
  margin: 0,
  color: color.danger,
  fontSize: '0.75rem',
  lineHeight: 1.4,
})

export const formError = css({
  marginBlockStart: '1.5rem',
  border: `1px solid ${color.danger}`,
  borderRadius: '0.5rem',
  background: color.dangerSoft,
  color: color.danger,
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
})

export const checkboxField = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'start',
  gap: '0.5rem 0.75rem',
  border: `1px solid ${color.border}`,
  borderRadius: '0.5rem',
  background: color.surfaceMuted,
  padding: '1rem',
})

export const checkboxLabel = css({
  color: color.textSecondary,
  fontSize: '0.875rem',
  fontWeight: 600,
  lineHeight: 1.4,
})

export const submitButton = css({
  justifySelf: 'start',
  '@media (max-width: 32rem)': {
    justifySelf: 'stretch',
  },
})

export const databasePanel = css({
  boxShadow: 'none',
})

export const databaseHeader = css({
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: '1rem',
})

export const databaseHeading = css({
  marginBlock: '0.25rem 0',
  fontSize: '1.25rem',
  letterSpacing: '-0.025em',
})

export const databaseCount = css({
  margin: 0,
  color: color.textMuted,
  fontSize: '0.75rem',
  fontWeight: 650,
})

export const databaseDescription = css({
  marginBlock: '1rem 0',
  color: color.textSecondary,
  fontSize: '0.8125rem',
  lineHeight: 1.55,
})

export const emptyDatabase = css({
  marginBlock: '1.5rem 0',
  border: `1px dashed ${color.borderStrong}`,
  borderRadius: '0.5rem',
  color: color.textMuted,
  padding: '1.25rem',
  fontSize: '0.875rem',
  textAlign: 'center',
})

export const accountList = css({
  display: 'grid',
  gap: '1rem',
  marginBlock: '1.5rem 0',
  padding: 0,
  listStyle: 'none',
})

export const accountItem = css({
  border: `1px solid ${color.border}`,
  borderRadius: '0.5rem',
  background: color.surfaceMuted,
  padding: '1rem',
})

export const accountHeading = css({
  margin: 0,
  fontSize: '1rem',
  letterSpacing: '-0.015em',
})

export const resultList = css({
  display: 'grid',
  marginBlock: '1rem 0',
  borderBlockStart: `1px solid ${color.border}`,
})

export const resultItem = css({
  display: 'grid',
  gridTemplateColumns: '9rem minmax(0, 1fr)',
  gap: '1rem',
  paddingBlock: '0.875rem',
  borderBlockEnd: `1px solid ${color.border}`,
  '@media (max-width: 28rem)': {
    gridTemplateColumns: '1fr',
    gap: '0.25rem',
  },
})

export const resultLabel = css({
  color: color.textMuted,
  fontSize: '0.75rem',
  fontWeight: 650,
  textTransform: 'uppercase',
})

export const resultValue = css({
  minWidth: 0,
  margin: 0,
  overflowWrap: 'anywhere',
  color: color.text,
  fontSize: '0.875rem',
})
