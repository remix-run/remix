import type { Handle, RemixNode } from 'remix/ui'
import { PagefindElements } from 'remix-docs-shared/search'

import { devRefreshScript, scriptEntry, stylesheetHref, stylesheetPreloads } from '../assets.ts'

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
    let { href, importMap, preloads } = scriptEntry

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
          <script type="importmap">{JSON.stringify(importMap)}</script>
          {devRefreshScript ? (
            <script type="importmap">{JSON.stringify(devRefreshScript.importMap)}</script>
          ) : null}
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          {stylesheetPreloads.map((href) => (
            <link key={href} rel="preload" href={href} as="style" />
          ))}
          {searchEnabled ? (
            <script type="module" src="/assets/pagefind/pagefind-component-ui.js"></script>
          ) : null}
          {devRefreshScript ? <script type="module" src={devRefreshScript.href}></script> : null}
          <script type="module" src={href}></script>
        </head>
        <body>
          {children}
          {searchEnabled ? <PagefindElements baseUrl="/" bundlePath="/assets/pagefind/" /> : null}
        </body>
      </html>
    )
  }
}
