import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { Glyph } from '@remix-run/ui/glyph'
import { theme } from '@remix-run/ui/theme'
interface PageSectionProps {
    children: RemixNode
    description?: string
    title?: string
}

export function PageSection(handle: Handle<PageSectionProps>) {
  return () => {
    let { children, description, title } = handle.props
    return (
    <section mix={sectionCss}>
      {title || description ? (
        <div mix={sectionHeaderCss}>
          {title ? <h2 mix={sectionTitleCss}>{title}</h2> : null}
          {description ? <p mix={sectionDescriptionCss}>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
  }
}

interface ShowcaseLinkCardProps {
    description: string
    eyebrow: string
    href: string
    title: string
}

export function ShowcaseLinkCard(handle: Handle<ShowcaseLinkCardProps>) {
  return () => {
    let { description, eyebrow, href, title } = handle.props
    return (
    <a href={href} mix={[panelCss, linkCardCss]}>
      <div mix={linkCardHeaderCss}>
        <p mix={eyebrowTextCss}>{eyebrow}</p>
        <h3 mix={panelTitleTextCss}>{title}</h3>
        <p mix={panelDescriptionTextCss}>{description}</p>
      </div>
      <span mix={linkCardActionCss}>
        <span mix={captionTextCss}>Open page</span>
        <Glyph mix={linkCardGlyphCss} name="chevronRight" />
      </span>
    </a>
  )
  }
}

export const panelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

export const panelInsetCss = css({
  backgroundColor: theme.surface.lvl1,
})

export const panelElevatedCss = css({
  boxShadow: theme.shadow.sm,
})

export const panelHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

export const panelBodyCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  minWidth: 0,
})

export const panelFooterCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
})

export const eyebrowTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

export const panelTitleTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

export const panelDescriptionTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

export const bodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

export const captionTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.muted,
})

export const labelTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

export const pageStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xxl,
})

export const featureGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

export const exampleGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

export const compactGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

export const tokenGroupGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

export const tokenGroupCardCss = css({
  gap: theme.space.sm,
  minHeight: '140px',
})

export const tokenChipRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.xs,
})

export const tokenChipCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.control.height.sm,
  paddingInline: theme.space.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.full,
  backgroundColor: theme.surface.lvl1,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.secondary,
})

export const noteCardCss = css({
  gap: theme.space.sm,
})

export const noteListCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  margin: 0,
  paddingLeft: theme.space.lg,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
})

const sectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

const sectionHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  maxWidth: '48rem',
})

const sectionTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const sectionDescriptionCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const linkCardCss = css({
  justifyContent: 'space-between',
  gap: theme.space.lg,
  color: theme.colors.text.primary,
  textDecoration: 'none',
  transitionProperty: 'transform, box-shadow, border-color',
  transitionDuration: '120ms',
  transitionTimingFunction: 'ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: theme.shadow.sm,
    borderColor: theme.colors.border.default,
  },
})

const linkCardHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const linkCardActionCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  color: theme.colors.text.secondary,
})

const linkCardGlyphCss = css({
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: 'currentColor',
  flexShrink: 0,
})
