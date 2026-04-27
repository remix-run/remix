import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { Glyph } from '@remix-run/ui/glyph'
import { theme } from '@remix-run/ui/theme'
interface ExamplePreviewProps {
    children: RemixNode
    code: string
    description?: string
    href?: string
    title?: string
}

export function ExamplePreview(handle: Handle<ExamplePreviewProps>) {
  return () => {
    let { children, code, description, href, title } = handle.props
    return (
    <div mix={exampleBlockCss}>
      {title || description ? (
        <div mix={exampleIntroCss}>
          {title ? <h3 mix={exampleTitleCss}>{title}</h3> : null}
          {description ? <p mix={exampleDescriptionCss}>{description}</p> : null}
        </div>
      ) : null}
      <article mix={exampleCardCss}>
        {href ? (
          <a
            aria-label="Open standalone example"
            href={href}
            mix={exampleExpandLinkCss}
            title="Open standalone example"
          >
            <Glyph mix={exampleExpandGlyphCss} name="expand" />
          </a>
        ) : null}
        <div mix={examplePreviewSurfaceCss}>
          <div mix={exampleCanvasCss}>{children}</div>
        </div>
        <div mix={exampleCodePanelCss}>
          <code mix={exampleCodeCss}>{code}</code>
        </div>
      </article>
    </div>
  )
  }
}

export const standaloneExampleBodyCss = css({
  margin: 0,
  minHeight: '100vh',
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  fontFamily: theme.fontFamily.sans,
  padding: theme.space.xl,
  boxSizing: 'border-box',
})

export const standaloneExampleBodyPadCss = css({
  padding: theme.space.xxl,
})

export const exampleCanvasCss = css({
  maxWidth: '44rem',
  marginInline: 'auto',
})

const exampleBlockCss = css({
  display: 'grid',
  gap: theme.space.sm,
})

const exampleIntroCss = css({
  display: 'grid',
  gap: theme.space.xs,
})

const exampleTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const exampleDescriptionCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const exampleCardCss = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  overflow: 'hidden',
})

const examplePreviewSurfaceCss = css({
  display: 'grid',
  alignItems: 'center',
  minHeight: '180px',
  padding: theme.space.xxl,
  backgroundColor: theme.surface.lvl0,
})

const exampleCodePanelCss = css({
  padding: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: 'color-mix(in oklab, rgb(248 248 248) 76%, white)',
  overflowX: 'auto',
})

const exampleCodeCss = css({
  display: 'block',
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.secondary,
  minWidth: 'max-content',
  whiteSpace: 'pre',
})

const exampleExpandLinkCss = css({
  position: 'absolute',
  top: theme.space.sm,
  right: theme.space.sm,
  zIndex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: `calc(${theme.control.height.sm} - 2px)`,
  height: `calc(${theme.control.height.sm} - 2px)`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  backgroundColor: 'color-mix(in oklab, white 82%, transparent)',
  border: `1px solid color-mix(in oklab, ${theme.colors.border.subtle} 78%, white)`,
  boxShadow: theme.shadow.xs,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
    backgroundColor: theme.surface.lvl0,
  },
})

const exampleExpandGlyphCss = css({
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: 'currentColor',
  flexShrink: 0,
})
