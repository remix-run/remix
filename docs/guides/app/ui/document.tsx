import type { Handle, RemixNode } from 'remix/ui'
import { PagefindElements } from 'remix-docs-shared/search'

import {
  devRefreshScriptSrc,
  scriptPreloads,
  scriptSrc,
  stylesheetHref,
  stylesheetPreloads,
} from '../assets.ts'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
  description?: string
  searchEnabled: boolean
}

const DEFAULT_TITLE = 'Remix Docs'
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE, description, searchEnabled } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {description ? <meta name="description" content={description} /> : null}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
          {searchEnabled ? (
            <link rel="stylesheet" href="/assets/pagefind/pagefind-component-ui.css" />
          ) : null}
          <link rel="stylesheet" href={stylesheetHref} />
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          {stylesheetPreloads.map((href) => (
            <link key={href} rel="preload" href={href} as="style" />
          ))}
          {searchEnabled ? (
            <script type="module" src="/assets/pagefind/pagefind-component-ui.js"></script>
          ) : null}
          {devRefreshScriptSrc ? <script type="module" src={devRefreshScriptSrc}></script> : null}
          <script type="module" src={scriptSrc}></script>
        </head>
        <body>
          {children}
          {searchEnabled ? <PagefindElements baseUrl="/" bundlePath="/assets/pagefind/" /> : null}
        </body>
      </html>
    )
  }
}
