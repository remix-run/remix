import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { getCurrentUserSafely } from '../utils/context.ts'
import { Document } from './document.tsx'

const containerStyle = css({ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' })

export interface LayoutProps {
  title?: string
  head?: RemixNode
  children?: RemixNode
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, head, children } = handle.props
    let user = getCurrentUserSafely()

    return (
      <Document title={title} head={head}>
        <header
          mix={css({
            background: '#2c3e50',
            color: 'white',
            padding: '1rem 0',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          })}
        >
          <div
            mix={[
              containerStyle,
              css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                '@media (max-width: 768px)': {
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '0.75rem',
                },
              }),
            ]}
          >
            <h1 mix={css({ fontSize: '1.5rem' })}>
              <a
                data-rmx-prefetch="intent"
                href={routes.home.href()}
                mix={css({ color: 'white', textDecoration: 'none' })}
              >
                🎵 Record Store
              </a>
            </h1>
            <nav
              mix={css({
                '& a': {
                  color: 'white',
                  textDecoration: 'none',
                  marginLeft: '1.5rem',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                  '&:hover': { background: 'rgba(255, 255, 255, 0.1)' },
                },
                '@media (max-width: 768px)': {
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  '& a': { marginLeft: 0 },
                },
              })}
            >
              <a data-rmx-prefetch="intent" href={routes.home.href()}>
                Home
              </a>
              <a data-rmx-prefetch="intent" href={routes.albums.index.href()}>
                Records
              </a>
              <a data-rmx-prefetch="intent" href={routes.about.href()}>
                About
              </a>
              <a data-rmx-prefetch="intent" href={routes.contact.index.href()}>
                Contact
              </a>
              <a data-rmx-prefetch="intent" href={routes.cart.index.href()}>
                Cart
              </a>
              {user ? (
                <>
                  <a data-rmx-prefetch="intent" href={routes.account.index.href()}>
                    Account
                  </a>
                  {user.role === 'admin' ? (
                    <a data-rmx-prefetch="intent" href={routes.admin.index.href()}>
                      Admin
                    </a>
                  ) : null}
                  <form
                    method="POST"
                    action={routes.auth.logout.href()}
                    mix={css({ display: 'inline' })}
                  >
                    <button
                      type="submit"
                      class="btn btn-secondary"
                      mix={css({ marginLeft: '1rem' })}
                    >
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href={routes.auth.login.index.href()}>Login</a>
                  <a data-rmx-prefetch="intent" href={routes.auth.register.index.href()}>
                    Register
                  </a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main
          mix={css({
            padding: '2rem 0',
            minHeight: 'calc(100vh - 200px)',
            viewTransitionName: 'record-store-page',
          })}
        >
          <div mix={containerStyle}>{children}</div>
        </main>
        <footer
          mix={css({
            background: '#34495e',
            color: 'white',
            padding: '2rem 0',
            marginTop: '4rem',
          })}
        >
          <div mix={containerStyle}>
            <p>&copy; {new Date().getFullYear()} Record Store Demo. Built with Remix.</p>
          </div>
        </footer>
      </Document>
    )
  }
}
