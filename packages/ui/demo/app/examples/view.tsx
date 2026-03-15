import { css } from 'remix/component'
import {
  createGlyphSheet,
  RMX_01,
  RMX_01_GLYPHS,
  theme,
  ui,
} from 'remix/ui'
import type { ExampleEntry } from './index.tsx'

let RMX_01Glyphs = createGlyphSheet(RMX_01_GLYPHS)

export function ExampleDocument() {
  return ({ example }: { example: ExampleEntry }) => (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <title>{`${example.title} | RMX_01 Example`}</title>
        <RMX_01 />
      </head>
      <body mix={bodyCss}>
        <RMX_01Glyphs />
        <main mix={mainCss}>
          <div mix={frameCss}>
            <header mix={headerCss}>
              <p mix={ui.text.eyebrow}>Standalone example</p>
              <h1 mix={[ui.text.title, resetHeadingCss]}>{example.title}</h1>
              {example.docsPath ? (
                <a href={example.docsPath} mix={docsLinkCss}>
                  Back to docs
                </a>
              ) : null}
            </header>

            <section mix={previewShellCss}>{example.preview}</section>
          </div>
        </main>
      </body>
    </html>
  )
}

let bodyCss = css({
  margin: 0,
  minHeight: '100vh',
  background:
    'linear-gradient(color-mix(in oklab, rgb(246, 246, 246) 72%, white) 0%, white 18%)',
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
})

let mainCss = css({
  minHeight: '100vh',
  padding: theme.space.xl,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

let frameCss = css({
  width: '100%',
  maxWidth: '960px',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

let headerCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

let resetHeadingCss = css({
  margin: 0,
})

let docsLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  marginTop: theme.space.sm,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.text.link,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
})

let previewShellCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '320px',
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surface,
  boxShadow: theme.shadow.xs,
  overflow: 'auto',
})
