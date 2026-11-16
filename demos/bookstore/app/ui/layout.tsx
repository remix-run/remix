import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { getCurrentUserSafely } from '../utils/context.ts'
import { Document } from './document.tsx'
import { NavigationProgress } from './public/navigation-progress.tsx'
import { PendingLink } from './public/pending-link.tsx'

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
        <NavigationProgress />
        <header>
          <div class="container">
            <h1>
              <PendingLink prefetch="intent" href={routes.home.href()}>
                📚 Bookstore
              </PendingLink>
            </h1>
            <nav>
              <PendingLink prefetch="intent" href={routes.home.href()}>
                Home
              </PendingLink>
              <PendingLink prefetch="intent" href={routes.books.index.href()}>
                Books
              </PendingLink>
              <PendingLink prefetch="intent" href={routes.about.href()}>
                About
              </PendingLink>
              <PendingLink prefetch="intent" href={routes.contact.index.href()}>
                Contact
              </PendingLink>
              <PendingLink prefetch="intent" href={routes.cart.index.href()}>
                Cart
              </PendingLink>
              {user ? (
                <>
                  <PendingLink prefetch="intent" href={routes.account.index.href()}>
                    Account
                  </PendingLink>
                  {user.role === 'admin' ? (
                    <PendingLink prefetch="intent" href={routes.admin.index.href()}>
                      Admin
                    </PendingLink>
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
                  <PendingLink href={routes.auth.login.index.href()}>Login</PendingLink>
                  <PendingLink prefetch="intent" href={routes.auth.register.index.href()}>
                    Register
                  </PendingLink>
                </>
              )}
            </nav>
          </div>
        </header>
        <main mix={css({ viewTransitionName: 'bookstore-page' })}>
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
