import { css } from 'remix/ui'
import { Button } from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { theme } from '@remix-run/ui/theme'
export default function Example() {
  return () => (
    <div mix={frameCss}>
      <div mix={panelCss}>
        <p mix={eyebrowCss}>Components</p>
        <h3 mix={titleCss}>Use the wrapper, or compose the pieces.</h3>
        <p mix={bodyCss}>
          Component modules are designed to work at two levels: a convenience wrapper for the common
          case, and lower-level building blocks when you need to own the markup yourself.
        </p>
      </div>
      <div mix={chipRowCss}>
        <span mix={chipCss}>select.Context</span>
        <span mix={chipCss}>select.trigger()</span>
        <span mix={chipCss}>select.triggerStyle</span>
        <span mix={chipCss}>&lt;Select /&gt;</span>
      </div>
      <div mix={actionRowCss}>
        <Button tone="secondary">Compose</Button>
        <Button startIcon={<Glyph name="add" />} tone="primary">
          Start with a wrapper
        </Button>
      </div>
    </div>
  )
}

let frameCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  width: '100%',
})

let panelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl1,
  boxShadow: theme.shadow.xs,
})

let eyebrowCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let bodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let chipRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.xs,
})

let chipCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.control.height.sm,
  paddingInline: theme.space.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.full,
  backgroundColor: theme.surface.lvl0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.secondary,
})

let actionRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})
