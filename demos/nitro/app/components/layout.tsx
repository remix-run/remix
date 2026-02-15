import type { RemixNode } from 'remix/component'

import assets from './client.ts?assets=client'

export function Document() {
  return ({ children, title = 'Nitro + Remix' }: { title?: string; children?: RemixNode }) => (
    <html lang="en-US">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
      </head>
      <body>
        {children}
        {assets.js.map((asset) => (
          <link rel="modulepreload" href={asset.href} />
        ))}
        <script type="module" src={assets.entry} />
      </body>
    </html>
  )
}
