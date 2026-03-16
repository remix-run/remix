import { css } from 'remix/component'

export let localDemoOrigin = 'http://127.0.0.1:44100'

export let stackLgStyle = css({
  display: 'grid',
  gap: '18px',
})

export let stackMdStyle = css({
  display: 'grid',
  gap: '14px',
})

export let stackSmStyle = css({
  display: 'grid',
  gap: '6px',
})

export let sectionTitleStyle = css({
  margin: 0,
  lineHeight: 1.04,
})

export let mutedTextStyle = css({
  margin: 0,
  lineHeight: 1.58,
  '& a': {
    color: 'inherit',
    fontWeight: 700,
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '0.18em',
  },
  '& a:hover': {
    opacity: 0.78,
  },
})

export let noticeStyle = css({
  borderRadius: 'var(--radius-lg)',
  padding: '12px 14px',
  border: '1px solid var(--error-border)',
  maxWidth: '760px',
  width: '100%',
})

export let panelStyle = css({
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  borderRadius: 'var(--radius-xl)',
})

export let authCardStyle = css({
  width: 'min(980px, 100%)',
  padding: 0,
  boxShadow: '0 18px 38px rgba(15, 23, 42, 0.14)',
  overflow: 'hidden',
})

export let authSplitStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(280px, 0.84fr)',
  alignItems: 'stretch',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

export let eyebrowStyle = css({
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: '0.74rem',
  fontWeight: 700,
  color: 'var(--muted)',
})

export let credentialsPaneStyle = css({
  padding: '28px',
  background: 'rgba(255, 255, 255, 0.98)',
  '@media (max-width: 980px)': {
    padding: '22px',
  },
  '@media (max-width: 640px)': {
    padding: '18px 18px',
  },
})

export let socialPaneStyle = css({
  padding: '28px',
  display: 'grid',
  alignContent: 'start',
  background:
    'radial-gradient(circle at top right, rgba(37, 99, 235, 0.06), transparent 34%), linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.95))',
  '@media (max-width: 980px)': {
    padding: '22px',
  },
  '@media (max-width: 640px)': {
    padding: '18px 18px',
  },
})

export let authDividerStyle = css({
  display: 'grid',
  placeItems: 'center',
  padding: '0 8px',
  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.06))',
  '@media (max-width: 980px)': {
    display: 'none',
  },
})

export let authDividerBubbleStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: '38px',
  height: '38px',
  borderRadius: '999px',
  background: '#ffffff',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  color: 'var(--muted)',
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
})

export let credentialsFormStyle = css({
  display: 'grid',
  gap: '14px',
})

export let formGridStyle = css({
  display: 'grid',
  gap: '12px',
})

export let fieldStyle = css({
  display: 'grid',
  gap: '6px',
})

export let fieldLabelStyle = css({
  fontSize: '0.84rem',
  fontWeight: 700,
  color: 'var(--text)',
})

export let fieldInputStyle = css({
  width: '100%',
  border: '1px solid rgba(15, 23, 42, 0.1)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.9rem 0.95rem',
  font: 'inherit',
  color: 'var(--text)',
  background: '#ffffff',
  transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
  '&:focus': {
    outline: 'none',
    borderColor: 'rgba(37, 99, 235, 0.46)',
    boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.12)',
  },
})

let buttonBaseDeclarations = {
  display: 'grid',
  alignItems: 'center',
  width: '100%',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 32px rgba(15, 23, 42, 0.12)',
  },
}

export let primaryButtonStyle = css({
  ...buttonBaseDeclarations,
  justifyContent: 'center',
  gridTemplateColumns: '1fr',
  minHeight: '46px',
  padding: '7px 10px',
  color: '#ffffff',
  font: 'inherit',
  fontSize: '0.94rem',
  fontWeight: 700,
  background: 'var(--primary)',
})

export let logoutButtonStyle = css({
  ...buttonBaseDeclarations,
  justifyContent: 'center',
  gridTemplateColumns: '1fr',
  maxWidth: '220px',
  margin: '0 28px 28px',
  padding: '9px 12px',
  color: '#ffffff',
  font: 'inherit',
  fontSize: '0.94rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #0f172a, #334155)',
  '@media (max-width: 640px)': {
    margin: '0 18px 18px',
  },
})

export let demoAccountStyle = css({
  border: '1px solid var(--border)',
  background: '#f8fafc',
  borderRadius: 'var(--radius-xl)',
  padding: '14px 16px',
})

export let demoAccountLabelStyle = css({
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: '0.74rem',
  fontWeight: 700,
  color: 'var(--muted)',
})

export let providerListStyle = css({
  display: 'grid',
  gap: '12px',
  width: '100%',
})

export let providerButtonStyle = css({
  ...buttonBaseDeclarations,
  gridTemplateColumns: 'auto 1fr',
  gap: '10px',
  padding: '7px 10px',
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.62,
    transform: 'none',
    boxShadow: 'none',
  },
})

export let providerThemeStyles = {
  google: css({
    background: '#ffffff',
    color: '#1f2937',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  }),
  github: css({
    background: 'var(--github)',
    color: '#1f2937',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  }),
  x: css({
    background: 'linear-gradient(135deg, #2a2a2a, var(--x))',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
  }),
} as const

export let providerMarkStyle = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-md)',
  background: 'rgba(255, 255, 255, 0.18)',
  flexShrink: 0,
})

export let providerMarkThemeStyles = {
  google: css({
    background: '#f4f7fb',
    boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.04)',
  }),
  github: css({
    background: 'rgba(255, 255, 255, 0.78)',
    boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.06)',
  }),
  x: css({}),
} as const

export let providerIconStyle = css({
  display: 'block',
  width: '15px',
  height: '15px',
})

export let providerIconInvertedStyle = css({
  filter: 'brightness(0) invert(1)',
})

export let providerBodyStyle = css({
  display: 'grid',
  gap: 0,
  textAlign: 'left',
})

export let providerTitleStyle = css({
  fontSize: '0.94rem',
  fontWeight: 700,
  lineHeight: 1.15,
})

export let setupCardStyle = css({
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  borderRadius: 'var(--radius-xl)',
  padding: '18px',
})

export let setupGuideCardStyle = css({
  width: '100%',
  background: 'rgba(244, 249, 248, 0.94)',
  boxShadow: '0 22px 48px rgba(15, 23, 42, 0.1)',
})

export let setupTopicStyle = css({
  paddingTop: '12px',
  borderTop: '1px solid rgba(148, 163, 184, 0.22)',
})

export let setupHeadingStyle = css({
  margin: 0,
  lineHeight: 1.2,
})

export let setupSubheadingStyle = css({
  margin: 0,
  lineHeight: 1.2,
  fontSize: '1rem',
})

export let setupColumnsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '16px',
  alignItems: 'start',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

export let setupListStyle = css({
  margin: 0,
  paddingLeft: '18px',
  display: 'grid',
  gap: '8px',
  lineHeight: 1.55,
})

export let setupProviderHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
})

export let setupStatusStyle = css({
  borderRadius: '999px',
  padding: '0.36rem 0.72rem',
  background: 'rgba(148, 163, 184, 0.18)',
  color: '#475569',
  fontSize: '0.76rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
})

export let setupDefinitionListStyle = css({
  margin: 0,
  display: 'grid',
  gap: '14px',
})

export let setupDefinitionTermStyle = css({
  marginBottom: '6px',
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted)',
})

export let setupDefinitionDescriptionStyle = css({
  margin: 0,
  display: 'grid',
  gap: '8px',
  lineHeight: 1.55,
  '& code': {
    width: '100%',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
})

export let identityRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '20px',
  alignItems: 'center',
  padding: '0 28px',
  '@media (max-width: 640px)': {
    paddingLeft: '18px',
    paddingRight: '18px',
    gridTemplateColumns: '1fr',
  },
})

export let profileDumpSectionStyle = css({
  padding: '0 28px',
  '@media (max-width: 640px)': {
    paddingLeft: '18px',
    paddingRight: '18px',
  },
})

export let profileDumpStyle = css({
  margin: 0,
  padding: '14px 16px',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  borderRadius: 'var(--radius-lg)',
  background: 'rgba(248, 250, 252, 0.96)',
  color: 'var(--text)',
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontSize: '0.9rem',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
})

export let avatarStyle = css({
  width: '88px',
  height: '88px',
  borderRadius: 'var(--radius-xl)',
  objectFit: 'cover',
  background: '#d7deea',
  '@media (max-width: 640px)': {
    width: '72px',
    height: '72px',
    borderRadius: '10px',
  },
})

export let avatarFallbackStyle = css({
  display: 'grid',
  placeItems: 'center',
  fontSize: '1.15rem',
  fontWeight: 800,
  color: '#ffffff',
  background: 'linear-gradient(135deg, #475569, #0f172a)',
})
