import type { RemixNode } from 'remix/component'

import { getAssetEntry } from '../middleware/asset-entry.ts'

export interface DocumentProps {
  title?: string
  children?: RemixNode
}

export function Document() {
  return ({ title = 'Bookstore', children }: DocumentProps) => {
    let { src, preloads } = getAssetEntry()

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          {preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" async src={src} />
          <link rel="stylesheet" href="/app.css" />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
