import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { getAssetEntry } from '../middleware/asset-entry.ts'
import * as styles from './public/styles.ts'

const rawCss = String.raw

interface DocumentProps {
  title: string
  children: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { href, importMap, preloads } = getAssetEntry().scriptEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light dark" />
          <title>{handle.props.title}</title>
          <link rel="icon" href="/favicon.ico" sizes="32x32" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href} />
          <style>
            {rawCss`
              @layer reset {
                *, *::before, *::after {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                }

                button, input {
                  font: inherit;
                }
              }

              :root {
                --page: #f3f4f6;
                --surface: #ffffff;
                --surface-hover: #f3f4f6;
                --border: #d1d5db;
                --text: #111827;
                --text-muted: #4b5563;
                --accent: #2563eb;
                --accent-hover: #1d4ed8;
                --accent-text: #ffffff;
                --error-surface: #fef2f2;
                --error-text: #991b1b;
                --success-surface: #f0fdf4;
                --success-text: #166534;
              }

              @media (prefers-color-scheme: dark) {
                :root {
                  --page: #0b0f17;
                  --surface: #161b26;
                  --surface-hover: #1f2633;
                  --border: #374151;
                  --text: #f3f4f6;
                  --text-muted: #9ca3af;
                  --accent: #3b82f6;
                  --accent-hover: #60a5fa;
                  --accent-text: #0b0f17;
                  --error-surface: #3b1219;
                  --error-text: #fecaca;
                  --success-surface: #0f2a1a;
                  --success-text: #bbf7d0;
                }
              }

              body {
                background: var(--page);
                color: var(--text);
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.5;
              }
            `}
          </style>
        </head>
        <body>
          <main mix={styles.page}>{handle.props.children}</main>
        </body>
      </html>
    )
  }
}
