import type { Handle, RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
  description?: string
}

const DEFAULT_TITLE = 'Remix Docs'

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE, description } = handle.props
    let { scriptSrc, scriptPreloads, stylesheetHref, devRefreshScriptSrc } = getAssetEntry()

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {description ? <meta name="description" content={description} /> : null}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="stylesheet" href={stylesheetHref} />
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <title>{title}</title>
          {head}
        </head>
        <body>
          {children}
          {devRefreshScriptSrc ? <script type="module" src={devRefreshScriptSrc}></script> : null}
          <script type="module" src={scriptSrc}></script>
        </body>
      </html>
    )
  }
}
