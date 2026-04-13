import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { Glyph, theme, ui } from 'remix/ui'

export function PageSection() {
  return ({
    children,
    description,
    title,
  }: {
    children: RemixNode
    description?: string
    title?: string
  }) => (
    <section mix={sectionCss}>
      {title || description ? (
        <div mix={sectionHeaderCss}>
          {title ? <h2 mix={[ui.text.title, sectionTitleCss]}>{title}</h2> : null}
          {description ? <p mix={[ui.text.bodySm, sectionDescriptionCss]}>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function ShowcaseLinkCard() {
  return ({
    description,
    eyebrow,
    href,
    title,
  }: {
    description: string
    eyebrow: string
    href: string
    title: string
  }) => (
    <a href={href} mix={linkCardCss}>
      <div mix={linkCardHeaderCss}>
        <p mix={ui.card.eyebrow}>{eyebrow}</p>
        <h3 mix={ui.card.title}>{title}</h3>
        <p mix={ui.card.description}>{description}</p>
      </div>
      <span mix={linkCardActionCss}>
        <span mix={ui.text.caption}>Open page</span>
        <Glyph mix={ui.icon.sm} name="chevronRight" />
      </span>
    </a>
  )
}

export let pageStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xxl,
})

export let featureGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

export let exampleGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

export let compactGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

export let tokenGroupGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

export let tokenGroupCardCss = css({
  gap: theme.space.sm,
  minHeight: '140px',
})

export let tokenChipRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.xs,
})

export let tokenChipCss = css({
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

export let noteCardCss = css({
  gap: theme.space.sm,
})

export let noteListCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  margin: 0,
  paddingLeft: theme.space.lg,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
})

let sectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

let sectionHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  maxWidth: '48rem',
})

let sectionTitleCss = css({
  margin: 0,
})

let sectionDescriptionCss = css({
  margin: 0,
})

let linkCardCss = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: theme.space.lg,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
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

let linkCardHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let linkCardActionCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  color: theme.colors.text.secondary,
})
