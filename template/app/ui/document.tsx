import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import { routes } from '../routes.ts'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
}

const DEFAULT_TITLE = readAppDisplayName('%%RMX_APP_DISPLAY_NAME_URI_COMPONENT%%')

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
        </head>
        <body mix={css({ margin: 0 })}>
          {children}
          <script type="module" src={routes.assets.href({ path: 'app/assets/entry.ts' })}></script>
        </body>
      </html>
    )
  }
}

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
