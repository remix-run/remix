import { clientEntry, css } from 'remix/component'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'

import { ThemeBuilder } from './theme-builder.tsx'

const ThemeBuilderClient = clientEntry('/assets/theme-builder.js#ThemeBuilder', ThemeBuilder)

export function ThemeBuilderDocument() {
  return () => (
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
        <title>Theme Builder | Remix UI Demo</title>
        <RMX_01 />
      </head>
      <body mix={bodyCss}>
        <RMX_01_GLYPHS />
        <ThemeBuilderClient />
      </body>
    </html>
  )
}

const bodyCss = css({
  margin: 0,
  backgroundColor: theme.surface.lvl0,
})
