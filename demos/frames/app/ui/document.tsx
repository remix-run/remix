import type { RemixNode } from 'remix/component'

type DocumentProps = {
  title: string
  maxWidth?: string
  children?: RemixNode
}

export function Document() {
  return ({ title, maxWidth = '760px', children }: DocumentProps) => (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <script async type="module" src="/assets/entry.js" />
      </head>
      <body
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
          margin: 0,
          padding: 24,
          background: '#0b1020',
          color: '#e9eefc',
        }}
      >
        <div style={{ maxWidth, margin: '0 auto' }}>{children}</div>
      </body>
    </html>
  )
}
