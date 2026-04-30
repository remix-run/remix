import { css } from 'remix/ui'
import { Button } from '@remix-run/ui/button'
import type { RemixNode } from 'remix/ui'
import { Glyph } from '@remix-run/ui/glyph'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'

export function AppDocument(props: { children: RemixNode }) {
  return (
    <html>
      <head>
        <RMX_01 />
      </head>
      <body>
        <RMX_01_GLYPHS />
        {props.children}
      </body>
    </html>
  )
}

export default function Example() {
  return () => (
    <article mix={panelCss}>
      <div mix={panelHeaderCss}>
        <p mix={eyebrowCss}>Installed once</p>
        <h3 mix={titleCss}>Theme + glyph sheet in the document</h3>
        <p mix={bodyCss}>
          Render the theme in the head, render glyphs in the body, then build the rest of the app on
          the shared `theme.*` values and component-owned UI contracts.
        </p>
      </div>
      <div mix={actionRowCss}>
        <Button startIcon={<Glyph name="add" />} tone="primary">
          New project
        </Button>
      </div>
    </article>
  )
}

let panelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

let panelHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
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

let actionRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})
