import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { Glyph, theme, ui } from 'remix/ui'

export function ExamplePreview() {
  return ({
    children,
    code,
    description,
    href,
    title,
  }: {
    children: RemixNode
    code: string
    description?: string
    href?: string
    title?: string
  }) => (
    <div mix={exampleBlockCss}>
      {title || description ? (
        <div mix={exampleIntroCss}>
          {title ? <h3 mix={[ui.text.title, exampleTitleCss]}>{title}</h3> : null}
          {description ? <p mix={[ui.text.bodySm, exampleDescriptionCss]}>{description}</p> : null}
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
            <Glyph mix={ui.icon.sm} name="expand" />
          </a>
        ) : null}
        <div mix={examplePreviewSurfaceCss}>
          <div mix={exampleCanvasCss}>{children}</div>
        </div>
        <div mix={exampleCodePanelCss}>
          <code mix={[ui.text.code, exampleCodeCss]}>{renderHighlightedCode(code)}</code>
        </div>
      </article>
    </div>
  )
}

export let standaloneExampleBodyCss = css({
  margin: 0,
  minHeight: '100vh',
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  fontFamily: theme.fontFamily.sans,
  padding: theme.space.xl,
  boxSizing: 'border-box',
})

export let standaloneExampleBodyPadCss = css({
  padding: theme.space.xxl,
})

export let exampleCanvasCss = css({
  maxWidth: '44rem',
  marginInline: 'auto',
})

let exampleBlockCss = css({
  display: 'grid',
  gap: theme.space.sm,
})

let exampleIntroCss = css({
  display: 'grid',
  gap: theme.space.xs,
})

let exampleTitleCss = css({
  margin: 0,
})

let exampleDescriptionCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
})

let exampleCardCss = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  overflow: 'hidden',
})

let examplePreviewSurfaceCss = css({
  display: 'grid',
  alignItems: 'center',
  minHeight: '180px',
  padding: theme.space.xxl,
  backgroundColor: theme.surface.lvl0,
})

let exampleCodePanelCss = css({
  padding: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: 'color-mix(in oklab, rgb(248 248 248) 76%, white)',
  overflowX: 'auto',
})

let exampleCodeCss = css({
  display: 'block',
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.secondary,
  minWidth: 'max-content',
  whiteSpace: 'pre',
})

let exampleExpandLinkCss = css({
  position: 'absolute',
  top: theme.space.sm,
  right: theme.space.sm,
  zIndex: theme.zIndex.sticky,
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

function renderHighlightedCode(code: string): RemixNode[] {
  let tokenPattern =
    /(\b(?:ui|theme)(?:\.[A-Za-z0-9_]+)+|\b(?:createTheme|createGlyphSheet|RMX_01|RMX_01_VALUES|RMX_01_GLYPHS|Glyph|Breadcrumbs|Accordion|AccordionItem|AccordionTrigger|AccordionContent|Listbox|ListboxOption|Menu|MenuButton|MenuList|MenuItem|SubmenuTrigger|popover)\b)/g
  let parts = code.split(tokenPattern)

  return parts.map((part, index) => {
    if (
      /^(?:ui|theme)\./.test(part) ||
      /^(?:createTheme|createGlyphSheet|RMX_01|RMX_01_VALUES|RMX_01_GLYPHS|Glyph|Breadcrumbs|Accordion|AccordionItem|AccordionTrigger|AccordionContent|Listbox|ListboxOption|Menu|MenuButton|MenuList|MenuItem|SubmenuTrigger|popover)$/.test(
        part,
      )
    ) {
      return (
        <span key={index} mix={apiCodeTokenCss}>
          {part}
        </span>
      )
    }

    return <span key={index}>{part}</span>
  })
}

let apiCodeTokenCss = css({
  color: theme.colors.text.link,
})
