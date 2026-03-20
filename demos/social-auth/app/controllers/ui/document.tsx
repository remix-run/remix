import type { RemixNode } from 'remix/component'

import * as styles from './styles.ts'

export interface DocumentProps {
  title: string
  children: RemixNode
}

export function Document() {
  return ({ title, children }: DocumentProps) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
      </head>
      <body mix={[styles.pageReset, styles.page]}>{children}</body>
    </html>
  )
}
