import { css, type Handle, type RemixNode } from 'remix/ui'

import type { AssetEntryValue } from '../middleware/asset-entry.ts'

interface DocumentProps {
  assetEntry: AssetEntryValue
  children?: RemixNode
  title?: string
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { assetEntry, children, title = 'Model-backed forms' } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          {assetEntry.scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script async type="module" src={assetEntry.scriptSrc} />
        </head>
        <body mix={body}>{children}</body>
      </html>
    )
  }
}

const body = css({
  minHeight: '100vh',
  margin: 0,
  background: '#f4f3ee',
  color: '#20201e',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
})
