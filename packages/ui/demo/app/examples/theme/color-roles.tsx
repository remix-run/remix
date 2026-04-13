import { css } from 'remix/component'
import { theme } from 'remix/ui'

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
        <span mix={[badgeCss, infoBadgeCss]}>Info</span>
        <span mix={[badgeCss, successBadgeCss]}>Success</span>
        <span mix={[badgeCss, warningBadgeCss]}>Warning</span>
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

let infoBadgeCss = css({
  backgroundColor: theme.colors.status.info.background,
  color: theme.colors.status.info.foreground,
  borderColor: theme.colors.status.info.border,
})

let successBadgeCss = css({
  backgroundColor: theme.colors.status.success.background,
  color: theme.colors.status.success.foreground,
  borderColor: theme.colors.status.success.border,
})

let warningBadgeCss = css({
  backgroundColor: theme.colors.status.warning.background,
  color: theme.colors.status.warning.foreground,
  borderColor: theme.colors.status.warning.border,
})
