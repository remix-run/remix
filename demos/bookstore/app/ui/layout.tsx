import type { RemixNode } from 'remix/component'

import { routes } from '../routes.ts'
import { getCurrentUserSafely } from '../utils/context.ts'
import { Document } from './document.tsx'

export interface LayoutProps {
  title?: string
  children?: RemixNode
}

export function Layout() {
  return ({ title, children }: LayoutProps) => {
    let user = getCurrentUserSafely()

    return (
      <Document title={title}>
        <header>
          <div class="container">
            <h1>
              <a href={routes.home.href()}>📚 Bookstore</a>
            </h1>
            <nav>
              <a href={routes.home.href()}>Home</a>
              <a href={routes.books.index.href()}>Books</a>
              <a href={routes.about.href()}>About</a>
              <a href={routes.contact.index.href()}>Contact</a>
              <a href={routes.cart.index.href()}>Cart</a>
              {user ? (
                <>
                  <a href={routes.account.index.href()}>Account</a>
                  {user.role === 'admin' ? <a href={routes.admin.index.href()}>Admin</a> : null}
                  <form
                    method="POST"
                    action={routes.auth.logout.href()}
                    style={{ display: 'inline' }}
                  >
                    <button type="submit" class="btn btn-secondary" style="margin-left: 1rem;">
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href={routes.auth.login.index.href()}>Login</a>
                  <a href={routes.auth.register.index.href()}>Register</a>
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
