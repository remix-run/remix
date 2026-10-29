import { css, type Handle, type RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { getScriptEntry } from '../middleware/asset-entry.ts'
import { getSpeedSettings } from '../middleware/speed-settings.ts'
import { formatDocumentTitle } from './public/document-title.tsx'
import { colors, fontStack } from './public/theme.ts'

export interface DocumentProps {
  title: string
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title, children } = handle.props
    let scriptEntry = getScriptEntry()
    let { techniques } = getSpeedSettings()

    return (
      <html lang="en" data-speed-techniques={techniques ? 'on' : 'off'}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{formatDocumentTitle(title)}</title>
          {/* An empty icon keeps the browser from requesting /favicon.ico on every visit. */}
          <link rel="icon" href="data:," />
          <ImportMap value={scriptEntry.importMap} />
          {scriptEntry.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={scriptEntry.href} />
        </head>
        <body mix={bodyStyle}>{children}</body>
      </html>
    )
  }
}

const bodyStyle = css({
  margin: 0,
  fontFamily: fontStack,
  fontSize: '14px',
  lineHeight: 1.45,
  color: colors.text,
  backgroundColor: '#fff',
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
})
