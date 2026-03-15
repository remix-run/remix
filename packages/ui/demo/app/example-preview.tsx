import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { theme, ui } from 'remix/ui'

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
    description: string
    href?: string
    title: string
  }) => (
    <div mix={exampleBlockCss}>
      <div mix={exampleIntroCss}>
        <h3 mix={[ui.text.title, exampleTitleCss]}>{title}</h3>
        <p mix={[ui.text.bodySm, exampleDescriptionCss]}>{description}</p>
      </div>
      <article mix={exampleCardCss}>
        <div mix={examplePreviewSurfaceCss}>
          <div mix={exampleCanvasCss}>{children}</div>
        </div>
        <div mix={exampleCodePanelCss}>
          <code mix={[ui.text.code, exampleCodeCss]}>{renderHighlightedCode(code)}</code>
          {href ? (
            <a href={href} mix={exampleLinkCss}>
              Open standalone example
            </a>
          ) : null}
        </div>
      </article>
    </div>
  )
}

export let standaloneExampleBodyCss = css({
  margin: 0,
  minHeight: '100vh',
  color: theme.colors.text.primary,
  backgroundColor: theme.colors.background.canvas,
  fontFamily: theme.fontFamily.sans,
  display: 'grid',
  placeItems: 'center',
  padding: theme.space.xl,
  boxSizing: 'border-box',
})

export let standaloneExampleBodyPadCss = css({
  padding: theme.space['2xl'],
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
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surface,
  overflow: 'hidden',
})

let examplePreviewSurfaceCss = css({
  display: 'grid',
  alignItems: 'center',
  minHeight: '180px',
  padding: theme.space['2xl'],
  backgroundColor: 'color-mix(in oklab, white 94%, rgb(245 246 248))',
  backgroundImage: [
    'linear-gradient(color-mix(in oklab, rgb(16 16 16) 5%, transparent) 1px, transparent 1px)',
    'linear-gradient(90deg, color-mix(in oklab, rgb(16 16 16) 5%, transparent) 1px, transparent 1px)',
    'linear-gradient(to bottom, color-mix(in oklab, rgb(250 250 250) 82%, white) 0%, white 100%)',
  ].join(', '),
  backgroundSize: '24px 24px, 24px 24px, 100% 100%',
  backgroundPosition: 'center center, center center, 0 0',
})

let exampleCodePanelCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  padding: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: 'color-mix(in oklab, rgb(248 248 248) 76%, white)',
  overflowX: 'auto',
  '@media (max-width: 640px)': {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
})

let exampleCodeCss = css({
  display: 'block',
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.secondary,
  minWidth: 'max-content',
  whiteSpace: 'pre',
})

let exampleLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  color: theme.colors.text.link,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
})

function renderHighlightedCode(code: string): RemixNode[] {
  let parts = code.split(/(ui\.[a-zA-Z0-9_.]+|theme\.[a-zA-Z0-9_.]+)/g)

  return parts.map((part, index) => {
    if (/^(ui|theme)\./.test(part)) {
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
