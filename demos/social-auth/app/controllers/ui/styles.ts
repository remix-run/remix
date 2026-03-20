import { css } from 'remix/component'

import { designSystem } from './design-system.ts'

let { tokens, theme } = designSystem

export let pageReset = css({
  '& *': {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
  },
  '& button, & input, & textarea, & select': {
    font: 'inherit',
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    fontWeight: tokens.typography.weight.semibold,
    lineHeight: tokens.typography.lineHeight.heading,
  },
  '& a': {
    color: 'inherit',
  },
})

export let page = css({
  margin: 0,
  width: '100vw',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: tokens.space.xl,
  background: theme.surface.pageBackground,
  fontFamily: tokens.typography.family.sans,
})

export let card = css({
  width: '100%',
  maxWidth: tokens.size.cardMaxWidth,
  padding: tokens.space.xxl,
  backgroundColor: theme.surface.card,
  borderRadius: tokens.radius.md,
  boxShadow: tokens.shadow.card,
})

export let cardHeader = css({
  marginBottom: tokens.space.xxl,
  textAlign: 'center',
})

export let heading = css({
  marginBottom: tokens.space.xs,
  fontSize: tokens.typography.size.title,
  fontWeight: tokens.typography.weight.semibold,
  color: theme.text.heading,
})

export let subtitle = css({
  color: theme.text.body,
  fontSize: tokens.typography.size.md,
})

export let form = css({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.lg,
})

export let fieldLabel = css({
  display: 'block',
  marginBottom: tokens.space.xs,
  fontSize: tokens.typography.size.sm,
  color: theme.text.label,
  fontWeight: tokens.typography.weight.medium,
})

export let fieldIcon = css({
  position: 'absolute',
  left: tokens.space.md,
  top: '50%',
  transform: 'translateY(-50%)',
  width: tokens.size.icon,
  height: tokens.size.icon,
  color: theme.icon.subtle,
})

export let fieldInput = css({
  width: '100%',
  padding: `${tokens.space.xs} ${tokens.space.lg} ${tokens.space.xs} ${tokens.space.fieldInset}`,
  border: theme.border.subtle,
  borderRadius: tokens.radius.md,
  outline: 'none',
  transition: theme.motion.allFast,
  fontSize: tokens.typography.size.md,
  backgroundColor: theme.surface.card,
  '&:focus': {
    borderColor: 'transparent',
    boxShadow: theme.action.focusRing,
  },
})

export let formOptions = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space.md,
  fontSize: tokens.typography.size.sm,
})

export let rememberMe = css({
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  color: theme.text.body,
})

export let rememberCheckbox = css({
  marginRight: tokens.space.xs,
  cursor: 'pointer',
})

export let helperLink = css({
  background: 'none',
  border: 'none',
  color: theme.action.link,
  cursor: 'pointer',
  padding: 0,
  fontSize: tokens.typography.size.sm,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
})

export let submitButton = css({
  width: '100%',
  display: 'block',
  padding: tokens.space.sm,
  backgroundColor: theme.action.primaryBackground,
  color: theme.text.inverse,
  border: 'none',
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  transition: theme.motion.backgroundFast,
  fontSize: tokens.typography.size.md,
  fontWeight: tokens.typography.weight.medium,
  textDecoration: 'none',
  textAlign: 'center',
  '&:link, &:visited': {
    color: theme.text.inverse,
    textDecoration: 'none',
  },
  '&:hover': {
    backgroundColor: theme.action.primaryBackgroundHover,
  },
})

export let secondaryButton = css({
  width: '100%',
  display: 'block',
  padding: tokens.space.sm,
  backgroundColor: theme.surface.card,
  color: theme.text.label,
  border: theme.border.subtle,
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  fontSize: tokens.typography.size.md,
  fontWeight: tokens.typography.weight.medium,
  textDecoration: 'none',
  textAlign: 'center',
  transition: theme.motion.backgroundFast,
  '&:link, &:visited': {
    color: theme.text.label,
    textDecoration: 'none',
  },
  '&:hover': {
    backgroundColor: theme.surface.subtleHover,
  },
})

export let divider = css({
  margin: `${tokens.space.xl} 0`,
  display: 'flex',
  alignItems: 'center',
})

export let dividerText = css({
  padding: `0 ${tokens.space.lg}`,
  fontSize: tokens.typography.size.sm,
  color: theme.text.muted,
})

export let socialButtons = css({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.md,
})

export let socialButton = css({
  width: '100%',
  padding: `${tokens.space.sm} ${tokens.space.lg}`,
  border: theme.border.subtle,
  borderRadius: tokens.radius.md,
  backgroundColor: theme.surface.card,
  cursor: 'pointer',
  transition: theme.motion.backgroundFast,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space.md,
  fontSize: tokens.typography.size.md,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: theme.surface.subtleHover,
  },
})

export let socialButtonDisabled = css({
  opacity: 0.55,
  cursor: 'not-allowed',
  '&:hover': {
    backgroundColor: theme.surface.card,
  },
})

export let socialIcon = css({
  width: tokens.size.icon,
  height: tokens.size.icon,
})

export let socialButtonLabel = css({
  color: theme.text.label,
  fontWeight: tokens.typography.weight.medium,
})

export let footerText = css({
  marginTop: tokens.space.xl,
  textAlign: 'center',
  fontSize: tokens.typography.size.sm,
  color: theme.text.body,
})

export let notice = css({
  padding: tokens.space.md,
  borderRadius: tokens.radius.md,
  marginBottom: tokens.space.lg,
  fontSize: tokens.typography.size.sm,
})

export let errorNotice = css({
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fecaca',
})

export let successNotice = css({
  backgroundColor: '#dcfce7',
  color: '#166534',
  border: '1px solid #bbf7d0',
})

export let infoPanel = css({
  padding: tokens.space.lg,
  borderRadius: tokens.radius.md,
  backgroundColor: theme.surface.subtleHover,
  color: theme.text.body,
  fontSize: tokens.typography.size.sm,
})

export let buttonRow = css({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.md,
  marginTop: tokens.space.lg,
})

export let profileHeader = css({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.lg,
  marginBottom: tokens.space.xl,
})

export let profileAvatar = css({
  width: '72px',
  height: '72px',
  borderRadius: '999px',
  objectFit: 'cover',
  border: theme.border.subtle,
  backgroundColor: theme.surface.subtleHover,
  display: 'block',
})

export let profileFallbackAvatar = css({
  width: '72px',
  height: '72px',
  borderRadius: '999px',
  backgroundColor: theme.action.primaryBackground,
  color: theme.text.inverse,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.5rem',
  fontWeight: tokens.typography.weight.semibold,
})

export let profileName = css({
  color: theme.text.heading,
  fontSize: '1.375rem',
  fontWeight: tokens.typography.weight.semibold,
})

export let profileMeta = css({
  color: theme.text.body,
  fontSize: tokens.typography.size.sm,
  marginTop: tokens.space.xs,
})

export let dataDump = css({
  marginTop: tokens.space.lg,
  padding: tokens.space.lg,
  borderRadius: tokens.radius.md,
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  overflowX: 'auto',
  fontSize: '0.85rem',
  lineHeight: 1.5,
})
