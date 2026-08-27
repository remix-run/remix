import type { Handle, RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'

export interface DocumentProps {
  title?: string
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title = 'Bookstore', children } = handle.props
    let { scriptEntry, stylesheetHref } = getAssetEntry()
    let { href, importMap, preloads } = scriptEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          <link rel="stylesheet" href={stylesheetHref} />
          <script type="importmap">{JSON.stringify(importMap)}</script>
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href} />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
