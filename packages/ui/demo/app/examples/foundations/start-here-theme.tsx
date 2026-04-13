import { css } from 'remix/component'
import { theme } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={frameCss}>
      <div mix={panelCss}>
        <p mix={labelCss}>theme.surface.lvl1</p>
        <p mix={titleCss}>Theme is the raw value contract.</p>
        <p mix={bodyCss}>
          Reach for `theme.*` when the component needs a specific space, surface, border, or type
          value without inventing a new semantic wrapper.
        </p>
      </div>
      <div mix={chipRowCss}>
        <span mix={chipCss}>theme.space.md</span>
        <span mix={chipCss}>theme.radius.lg</span>
        <span mix={chipCss}>theme.colors.text.primary</span>
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

let labelCss = css({
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
