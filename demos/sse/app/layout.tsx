import type { Remix } from '@remix-run/dom'

import { routes } from '../routes.ts'

const css = String.raw

export function Layout({ children }: { children?: Remix.RemixNode }): Remix.RemixNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Server-Sent Events Demo</title>
        <script type="module" async src={routes.assets.href({ path: 'entry.js' })} />
        <style>
          {css`
            @layer reset {
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
            }

            @keyframes pulse {
              0%,
              100% {
                opacity: 1;
              }
              50% {
                opacity: 0.5;
              }
            }

            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(-20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}
        </style>
      </head>
      <body
        css={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.5,
          padding: '2rem',
          maxWidth: '800px',
          margin: '0 auto',
          background: '#f5f5f5',
        }}
      >
        {children}
      </body>
    </html>
  )
}
