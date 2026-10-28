import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import { getContext } from 'remix/middleware/async-context'
import { getCspNonce } from 'remix/middleware/csp'

import { getAssetEntry } from '../middleware/asset-entry.ts'

export interface DocumentProps {
  title?: string
  head?: RemixNode
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title = 'Bookstore', head, children } = handle.props
    let { scriptEntry, stylesheetHref } = getAssetEntry()
    let { href, importMap, preloads } = scriptEntry
    let nonce = getCspNonce(getContext())

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          <link rel="stylesheet" href={stylesheetHref} />
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href} nonce={nonce} />
          {head}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
