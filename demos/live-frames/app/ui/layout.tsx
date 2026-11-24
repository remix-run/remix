import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { getAssetEntry } from '../middleware/asset-entry.ts'

const rawCss = String.raw

export function Layout(handle: Handle<{ children?: RemixNode }>) {
  return () => {
    let { href, importMap, preloads } = getAssetEntry().scriptEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Live Frames Demo</title>
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href} />
          <style>
            {rawCss`
              @layer reset {
                * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                }
              }

              body {
                background: #f8fafc;
                color: #0f172a;
                font-family: system-ui, sans-serif;
                line-height: 1.5;
              }
            `}
          </style>
        </head>
        <body>
          <main
            mix={css({
              maxWidth: '52rem',
              margin: '0 auto',
              padding: '2.5rem 1.25rem 4rem',
            })}
          >
            {handle.props.children}
          </main>
        </body>
      </html>
    )
  }
}
