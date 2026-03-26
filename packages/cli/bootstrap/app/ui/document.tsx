import type { RemixNode } from 'remix/component'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

export function Document() {
  return ({ title = '__RMX_APP_DISPLAY_NAME__', children }: DocumentProps) => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
