import type { RemixNode } from 'remix/ui'

import { routes } from '../routes.ts'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

const DEFAULT_TITLE = decodeURIComponent('%%RMX_APP_DISPLAY_NAME_URI_COMPONENT%%')

export function Document() {
  return ({ title = DEFAULT_TITLE, children }: DocumentProps) => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </head>
      <body>
        {children}
        <script
          type="module"
          src={routes.assets.index.href({ path: 'app/assets/entry.ts' })}
        ></script>
      </body>
    </html>
  )
}
