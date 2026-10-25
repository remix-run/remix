import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { getCurrentUserSafely } from '../utils/context.ts'
import { Document } from './document.tsx'

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
        <header>
          <div class="container">
            <h1>
              <a data-rmx-prefetch="intent" href={routes.home.href()}>
                📚 Bookstore
              </a>
            </h1>
            <nav>
              <a data-rmx-prefetch="intent" href={routes.home.href()}>
                Home
              </a>
              <a data-rmx-prefetch="intent" href={routes.books.index.href()}>
                Books
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
        <main>
          <div class="container">{children}</div>
        </main>
        <footer>
          <div class="container">
            <p>&copy; {new Date().getFullYear()} Bookstore Demo. Built with Remix.</p>
          </div>
        </footer>
      </Document>
    )
  }
}
