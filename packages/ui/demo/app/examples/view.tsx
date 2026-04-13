import { css } from 'remix/component'
import { createGlyphSheet, RMX_01, RMX_01_GLYPHS, theme } from 'remix/ui'
import { standaloneExampleBodyCss, standaloneExampleBodyPadCss } from '../example-preview.tsx'
import type { ExampleEntry } from './index.tsx'

let RMX_01Glyphs = createGlyphSheet(RMX_01_GLYPHS)

export function ExampleDocument() {
  return ({ example, pad = false }: { example: ExampleEntry; pad?: boolean }) => (
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
        <script async type="module" src="/assets/entry.js" />
        <title>{`${example.title} | RMX_01 Example`}</title>
        <RMX_01 />
      </head>
      <body
        mix={
          pad ? [standaloneExampleBodyCss, standaloneExampleBodyPadCss] : standaloneExampleBodyCss
        }
      >
        <RMX_01Glyphs />
        <div mix={shellCss}>
          <div mix={previewFrameCss}>{example.preview}</div>
        </div>
      </body>
    </html>
  )
}

let shellCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: `calc(100vh - (${theme.space.xl} * 2))`,
})

let previewFrameCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})
