import type { Handle, RemixNode } from 'remix/ui'

import { scriptPreloads, scriptSrc } from '../assets.ts'
import * as styles from './styles.ts'

interface DocumentProps {
  lang: string
  title: string
  children: RemixNode
}

/** HTML document shell with explicit localized metadata. */
export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html lang={handle.props.lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{handle.props.title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        {scriptPreloads.map((href) => (
          <link key={href} rel="modulepreload" href={href} />
        ))}
        <script type="module" src={scriptSrc}></script>
      </head>
      <body mix={styles.body}>{handle.props.children}</body>
    </html>
  )
}
