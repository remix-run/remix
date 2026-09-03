import { css } from 'remix/ui'

const sansFont =
  "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const monoFont = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"

export const body = css({
  minWidth: '320px',
  minHeight: '100vh',
  margin: 0,
  background: 'light-dark(#f3f5f7, #0d0d10)',
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  colorScheme: 'light dark',
  fontFamily: sansFont,
  fontSize: '16px',
  lineHeight: 1.6,
  WebkitFontSmoothing: 'antialiased',
  boxSizing: 'border-box',
  '& *, & *::before, & *::after': {
    boxSizing: 'inherit',
  },
  '& ::selection': {
    background: '#ffdf5f',
    color: '#1b1b1f',
  },
})

export const pageWrapper = css({
  width: 'calc(100% - 48px)',
  maxWidth: '1120px',
  minHeight: 'calc(100vh - 48px)',
  margin: '24px auto',
  padding: '0 52px 52px',
  borderRadius: '16px',
  background: 'light-dark(#ffffff, #0d0d10)',
  '@media (max-width: 900px)': {
    width: '100%',
    minHeight: '100vh',
    margin: 0,
    padding: '0 24px 40px',
    borderRadius: 0,
  },
})

export const header = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: '64px',
  padding: '16px 0',
  borderBottom: '1px solid light-dark(#e5e7eb, #2a2a30)',
  flexWrap: 'wrap',
  gap: '16px',
})

export const brandGroup = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  borderRadius: '4px',
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  textDecoration: 'none',
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '4px',
  },
})

export const logo = css({
  display: 'inline-block',
  fontSize: '24px',
  lineHeight: 1,
})

export const brandTitle = css({
  margin: 0,
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
})

export const switcherForm = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
})

export const select = css({
  height: '36px',
  padding: '0 32px 0 12px',
  border: '1px solid light-dark(#d1d5db, #3f3f46)',
  borderRadius: '8px',
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  backgroundColor: 'light-dark(#ffffff, #16161a)',
  fontFamily: 'inherit',
  fontSize: '14px',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '2px',
  },
})

export const button = css({
  height: '36px',
  padding: '0 16px',
  border: '1px solid light-dark(#1b1b1f, #e7e7ea)',
  borderRadius: '8px',
  color: 'light-dark(#ffffff, #0d0d10)',
  backgroundColor: 'light-dark(#1b1b1f, #e7e7ea)',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 150ms ease-in-out',
  '&:hover': {
    backgroundColor: 'light-dark(#3d3d41, #cbcbce)',
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '2px',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

export const clearPreferenceButton = css({
  minHeight: '36px',
  padding: '0 4px',
  border: 0,
  borderRadius: '4px',
  color: 'light-dark(#0578be, #2dacf9)',
  backgroundColor: 'transparent',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  '&:hover': {
    color: 'light-dark(#022f4b, #63c2fb)',
    textDecoration: 'underline',
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '2px',
  },
})

export const hero = css({
  maxWidth: '800px',
  padding: '64px 0 40px',
})

export const eyebrowBadge = css({
  marginBottom: '16px',
  color: 'light-dark(#eb2358, #ff5d7a)',
  fontSize: '12px',
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

export const heroHeading = css({
  maxWidth: '760px',
  margin: '0 0 16px',
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  fontSize: 'clamp(36px, 7vw, 48px)',
  fontWeight: 700,
  lineHeight: 1.08,
  letterSpacing: '-0.025em',
})

export const heroDescription = css({
  maxWidth: '720px',
  margin: '0 0 24px',
  color: 'light-dark(#6b7280, #9aa0aa)',
  fontSize: '18px',
  lineHeight: 1.6,
})

export const heroWelcome = css({
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '8px',
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  backgroundColor: 'light-dark(#f7f7f8, #16161a)',
  fontSize: '14px',
  fontWeight: 500,
})

export const quickSwitchContainer = css({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  margin: '0 0 52px',
  flexWrap: 'wrap',
})

export const quickSwitchLabel = css({
  marginRight: '4px',
  color: 'light-dark(#6b7280, #9aa0aa)',
  fontSize: '13px',
  fontWeight: 500,
})

export const quickSwitchPill = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '4px 10px',
  borderRadius: '8px',
  color: 'light-dark(#0578be, #2dacf9)',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background-color 150ms ease-in-out, color 150ms ease-in-out',
  '&:hover': {
    color: 'light-dark(#022f4b, #63c2fb)',
    backgroundColor: 'light-dark(rgb(0 0 0 / 5%), #2a2a30)',
  },
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '2px',
  },
  '&[aria-current="true"]': {
    color: 'light-dark(#1b1b1f, #e7e7ea)',
    backgroundColor: 'light-dark(rgb(0 0 0 / 10%), #2a2a30)',
    fontWeight: 700,
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

export const grid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
  alignItems: 'start',
  gap: '4px',
  marginBottom: '52px',
})

export const card = css({
  minWidth: 0,
  padding: '24px',
  borderRadius: '12px',
  backgroundColor: 'light-dark(#f7f7f8, #16161a)',
})

export const cardHeader = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '16px',
})

export const cardIcon = css({
  fontSize: '20px',
  lineHeight: 1,
})

export const cardTitle = css({
  margin: 0,
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
})

export const cardDescription = css({
  margin: '0 0 20px',
  color: 'light-dark(#6b7280, #9aa0aa)',
  fontSize: '14px',
  lineHeight: 1.5,
})

export const stepList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  margin: '0 0 20px',
  padding: 0,
  listStyle: 'none',
})

export const stepItem = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  minHeight: '40px',
  padding: '8px 12px',
  borderRadius: '8px',
  color: 'light-dark(#6b7280, #9aa0aa)',
  backgroundColor: 'light-dark(#ffffff, #0d0d10)',
  fontFamily: monoFont,
  fontSize: '12px',
  '&[data-active="true"]': {
    color: 'light-dark(#166534, #86efac)',
    backgroundColor: 'light-dark(rgb(34 197 94 / 14%), rgb(34 197 94 / 18%))',
    fontWeight: 600,
  },
})

export const activeBadge = css({
  flexShrink: 0,
  padding: '2px 7px',
  borderRadius: '9999px',
  color: 'light-dark(#166534, #86efac)',
  backgroundColor: 'light-dark(rgb(34 197 94 / 14%), rgb(34 197 94 / 18%))',
  fontFamily: sansFont,
  fontSize: '10px',
  fontWeight: 700,
  lineHeight: 1.5,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

export const demoRows = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

export const demoRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: '40px',
  padding: '8px 12px',
  borderRadius: '8px',
  gap: '8px 16px',
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  backgroundColor: 'light-dark(#ffffff, #0d0d10)',
  fontSize: '14px',
  flexWrap: 'wrap',
})

export const demoLabel = css({
  color: 'light-dark(#6b7280, #9aa0aa)',
  fontFamily: monoFont,
  fontSize: '12px',
  fontWeight: 400,
  overflowWrap: 'anywhere',
})

export const demoValue = css({
  color: 'light-dark(#1b1b1f, #e7e7ea)',
  fontSize: '13px',
  fontWeight: 600,
  overflowWrap: 'anywhere',
  textAlign: 'right',
})

export const srOnly = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
})

export const footer = css({
  padding: '28px 0 0',
  borderTop: '1px solid light-dark(#e5e7eb, #2a2a30)',
  color: 'light-dark(#6b7280, #9aa0aa)',
  fontFamily: monoFont,
  fontSize: '12px',
})
