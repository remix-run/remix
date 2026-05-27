import type { Handle, RemixNode } from 'remix/ui'
import { RMX_01, RMX_01_GLYPHS } from 'remix/ui/theme'

import { routes } from '../routes.ts'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

const DEFAULT_TITLE = 'Timeboxer'

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title = DEFAULT_TITLE, children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light" />
          <title>{title}</title>
          <RMX_01.Style />
        </head>
        <body>
          <RMX_01_GLYPHS />
          {children}
          <script
            type="module"
            src={routes.assets.index.href({ path: 'app/assets/entry.ts' })}
          ></script>
        </body>
      </html>
    )
  }
}
