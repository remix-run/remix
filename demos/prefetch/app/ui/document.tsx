import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { getScriptEntry } from '../middleware/asset-entry.ts'
import { routes } from '../routes.ts'

export function Document(handle: Handle<{ title: string; children?: RemixNode }>) {
  return () => {
    let { href, importMap, preloads } = getScriptEntry()

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`${handle.props.title} | Prefetch Demo`}</title>
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href} />
        </head>
        <body mix={bodyStyle}>
          <header mix={headerStyle}>
            <a href={routes.home.href()} mix={brandStyle}>
              Trailhead Goods
            </a>
          </header>
          <main mix={mainStyle}>{handle.props.children}</main>
        </body>
      </html>
    )
  }
}

const bodyStyle = css({
  margin: 0,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  color: '#1c1917',
  backgroundColor: '#fafaf9',
})

const headerStyle = css({
  padding: '1rem 2rem',
  borderBottom: '1px solid #e7e5e4',
  backgroundColor: '#ffffff',
})

const brandStyle = css({
  fontWeight: 700,
  color: '#1c1917',
  textDecoration: 'none',
})

const mainStyle = css({
  maxWidth: '60rem',
  margin: '0 auto',
  padding: '2rem',
})
