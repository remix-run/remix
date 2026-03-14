import { css } from 'remix/component'
import { theme } from 'remix/theme'

export let statusBadgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '22px',
  paddingInline: theme.space.sm,
  border: '1px solid transparent',
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

export let navPreviewCardCss = css({
  padding: theme.space.md,
})

export let cardExampleFrameCss = css({
  width: '100%',
  maxWidth: '500px',
})

export let fieldStackCss = css({
  width: '100%',
  maxWidth: '360px',
})

export let buttonScrollRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  width: 'max-content',
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: theme.space.xs,
  '& > *': {
    flexShrink: 0,
  },
})

export let buttonSpinnerGlyphCss = css({
  opacity: 0.72,
})

export let navPreviewGlyphCss = css({
  color: theme.colors.text.muted,
  flexShrink: 0,
})
