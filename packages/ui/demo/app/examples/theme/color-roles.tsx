import { css } from 'remix/component'
import { theme } from '@remix-run/ui/theme'
export default function Example() {
  return () => (
    <div mix={stackCss}>
      <div mix={textStackCss}>
        <p mix={[textCss, textPrimaryCss]}>theme.colors.text.primary</p>
        <p mix={[textCss, textSecondaryCss]}>theme.colors.text.secondary</p>
        <p mix={[textCss, textMutedCss]}>theme.colors.text.muted</p>
        <p mix={[textCss, textLinkCss]}>theme.colors.text.link</p>
      </div>
      <div mix={badgeRowCss}>
        <span mix={[badgeCss, primaryBadgeCss]}>Primary</span>
        <span mix={[badgeCss, secondaryBadgeCss]}>Secondary</span>
        <span mix={[badgeCss, dangerBadgeCss]}>Danger</span>
      </div>
    </div>
  )
}

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  width: '100%',
})

let textStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let textCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
})

let textPrimaryCss = css({
  color: theme.colors.text.primary,
})

let textSecondaryCss = css({
  color: theme.colors.text.secondary,
})

let textMutedCss = css({
  color: theme.colors.text.muted,
})

let textLinkCss = css({
  color: theme.colors.text.link,
})

let badgeRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

let badgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '24px',
  paddingInline: theme.space.sm,
  border: '1px solid transparent',
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

let primaryBadgeCss = css({
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderColor: theme.colors.action.primary.border,
})

let secondaryBadgeCss = css({
  backgroundColor: theme.colors.action.secondary.background,
  color: theme.colors.action.secondary.foreground,
  borderColor: theme.colors.action.secondary.border,
})

let dangerBadgeCss = css({
  backgroundColor: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderColor: theme.colors.action.danger.border,
})
