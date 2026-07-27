import type { Handle, RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'
import { bodyStyle, containerStyle } from './styles.ts'

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
        <body mix={bodyStyle}>
          {/* `maxWidth` is caller-driven, so it stays an inline style. */}
          <div mix={containerStyle} style={{ maxWidth }}>
            {children}
          </div>
        </body>
      </html>
    )
  }
}
