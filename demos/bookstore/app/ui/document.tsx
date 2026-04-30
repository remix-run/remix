import type { RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'

export interface DocumentProps {
  title?: string
  children?: RemixNode
}

export function Document() {
  return ({ title = 'Bookstore', children }: DocumentProps) => {
    let { scriptSrc, scriptPreloads, stylesheetHref } = getAssetEntry()

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          <link rel="stylesheet" href={stylesheetHref} />
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" async src={scriptSrc} />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
