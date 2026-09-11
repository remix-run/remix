import type { Handle, RemixNode } from 'remix/ui'
import { ImportMap } from 'remix/ui/server'

import { scriptEntry } from '../assets.ts'
import * as styles from './styles.ts'

interface DocumentProps {
  lang: string
  dir: 'ltr' | 'rtl'
  title: string
  children: RemixNode
}

/** HTML document shell with explicit localized metadata. */
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { href, importMap, preloads } = scriptEntry

    return (
      <html lang={handle.props.lang} dir={handle.props.dir}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{handle.props.title}</title>
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body mix={styles.body}>{handle.props.children}</body>
      </html>
    )
  }
}
