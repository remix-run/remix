import type { Handle, RemixNode } from 'remix/ui'
import { ImportMap } from 'remix/ui/server'

import { scriptEntry } from '../actions/assets/controller.ts'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

const DEFAULT_TITLE = 'Timeboxer'

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title = DEFAULT_TITLE, children } = handle.props
    let { href, importMap, preloads } = scriptEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light" />
          <title>{title}</title>
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
