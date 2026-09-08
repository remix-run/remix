import type { Handle, RemixNode } from 'remix/ui'

import * as styles from './styles.ts'

interface DocumentProps {
  title: string
  children: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <title>{handle.props.title}</title>
      </head>
      <body mix={[styles.pageReset, styles.page]}>{handle.props.children}</body>
    </html>
  )
}
