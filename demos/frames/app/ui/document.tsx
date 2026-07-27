import type { Handle, RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'

type DocumentProps = {
  title: string
  maxWidth?: string
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title, maxWidth = '760px', children } = handle.props
    let { scriptSrc, scriptPreloads } = getAssetEntry()

    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script async type="module" src={scriptSrc} />
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
}
