import type { RemixNode } from 'remix/component'

export function Document() {
  return ({ title = 'Social Login Demo', children }: { title?: string; children?: RemixNode }) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}

export function Layout() {
  return ({ children }: { children?: RemixNode }) => (
    <Document>
      <main class="page-shell">{children}</main>
    </Document>
  )
}
