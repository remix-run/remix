import type { Remix } from '@remix-run/dom'

import { routes } from './routes.ts'
import { getUser } from './utils/auth.ts'

const css = String.raw

export function Document({
  title = 'Auth Demo',
  children,
}: {
  title?: string
  children?: Remix.RemixNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>
          {css`
            @layer reset {
              *,
              *::before,
              *::after {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              button,
              input,
              select,
              textarea {
                font: inherit;
                color: inherit;
                line-height: inherit;
              }
              button {
                background: none;
                border: none;
                cursor: pointer;
              }
              img {
                display: block;
                max-width: 100%;
              }
              a {
                color: inherit;
                text-decoration: none;
              }
            }
          `}
        </style>
      </head>
      <body
        css={{
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          lineHeight: 1.6,
          color: '#1d1d1f',
          background: '#f5f5f7',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {children}
      </body>
    </html>
  )
}

export function Layout({ children }: { children?: Remix.RemixNode }) {
  let user = getUser()

  return (
    <Document>
      <header css={{ background: 'white', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <nav
          css={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '52px',
          }}
        >
          <a
            href={routes.home.href()}
            css={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1d1d1f' }}
          >
            Auth Demo
          </a>
          <div css={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {user ? (
              <a
                href={routes.account.index.href()}
                css={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  color: '#1d1d1f',
                  transition: 'opacity 0.15s ease',
                  ':hover': {
                    opacity: 0.7,
                  },
                }}
              >
                <div
                  css={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {user.name.charAt(0) ?? ' '}
                </div>
                <span>{user.name}</span>
              </a>
            ) : (
              <>
                <a href={routes.auth.login.index.href()} css={{ fontSize: '0.875rem' }}>
                  Log In
                </a>
                <a href={routes.auth.signUp.index.href()} css={{ fontSize: '0.875rem' }}>
                  Register
                </a>
              </>
            )}
          </div>
        </nav>
      </header>
      <main css={{ padding: '3rem 0', minHeight: 'calc(100vh - 52px)' }}>
        <div css={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>{children}</div>
      </main>
    </Document>
  )
}
