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
    fontSize: 'inherit',
    fontWeight: tokens.typography.weight.semibold,
    lineHeight: tokens.typography.lineHeight.heading,
  },
})

export let page = css({
  margin: 0,
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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

export let heading = css({
  marginBottom: tokens.space.xs,
  fontSize: tokens.typography.size.title,
  fontWeight: tokens.typography.weight.semibold,
  color: theme.text.heading,
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
  '&:focus': {
    borderColor: 'transparent',
    boxShadow: theme.action.focusRing,
  },
})

export let formOptions = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: tokens.typography.size.sm,
})

export let rememberMe = css({
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
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
  '&:hover': {
    textDecoration: 'underline',
  },
})

export let submitButton = css({
  width: '100%',
  padding: tokens.space.sm,
  backgroundColor: theme.action.primaryBackground,
  color: theme.text.inverse,
  border: 'none',
  borderRadius: tokens.radius.md,
  cursor: 'pointer',
  transition: theme.motion.backgroundFast,
  fontSize: tokens.typography.size.md,
  fontWeight: tokens.typography.weight.medium,
  '&:hover': {
    backgroundColor: theme.action.primaryBackgroundHover,
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
  '&:hover': {
    backgroundColor: theme.surface.subtleHover,
  },
})

export let socialIcon = css({
  width: tokens.size.icon,
  height: tokens.size.icon,
})
