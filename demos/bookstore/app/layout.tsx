import type { Remix } from '@remix-run/dom'

import { routes } from '../routes.ts'
import { getCurrentUser } from './utils/context.ts'
import type { User } from './models/users.ts'

export function Document({
  title = 'Bookstore',
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
        <script type="module" async src={routes.assets.href({ path: 'entry.js' })} />
        <style
          innerHTML={`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
          header { background: #2c3e50; color: white; padding: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          header .container { display: flex; justify-content: space-between; align-items: center; }
          header h1 { font-size: 1.5rem; }
          header h1 a { color: white; text-decoration: none; }
          nav a { color: white; text-decoration: none; margin-left: 1.5rem; padding: 0.5rem; border-radius: 4px; transition: background 0.2s; }
          nav a:hover { background: rgba(255,255,255,0.1); }
          main { padding: 2rem 0; min-height: calc(100vh - 200px); }
          footer { background: #34495e; color: white; padding: 2rem 0; margin-top: 4rem; }
          .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .btn { display: inline-block; padding: 0.5rem 1rem; background: #3498db; color: white; text-decoration: none; border-radius: 4px; border: none; cursor: pointer; font-size: 1rem; transition: background 0.2s; }
          .btn:hover { background: #2980b9; }
          .btn-secondary { background: #95a5a6; }
          .btn-secondary:hover { background: #7f8c8d; }
          .btn-danger { background: #e74c3c; }
          .btn-danger:hover { background: #c0392b; }
          .form-group { margin-bottom: 1rem; }
          .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
          .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; }
          .form-group textarea { min-height: 100px; resize: vertical; }
          .alert { padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
          .alert-success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
          .alert-error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
          .book-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s; }
          .book-card:hover { transform: translateY(-4px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
          .book-card img { width: 100%; height: 300px; object-fit: cover; background: #ecf0f1; }
          .book-card-body { padding: 1rem; }
          .book-card h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
          .book-card .author { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 0.5rem; }
          .book-card .price { font-size: 1.25rem; font-weight: bold; color: #27ae60; margin: 0.5rem 0; }
          table { width: 100%; border-collapse: collapse; background: white; }
          th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f8f9fa; font-weight: 600; }
          .actions { display: flex; gap: 0.5rem; }
          .actions form { display: inline; }
          .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; font-weight: 500; }
          .badge-success { background: #d4edda; color: #155724; }
          .badge-warning { background: #fff3cd; color: #856404; }
          .badge-info { background: #d1ecf1; color: #0c5460; }
        `}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

export function Layout({ children }: { children?: Remix.RemixNode }) {
  let user: User | null = null
  try {
    user = getCurrentUser()
  } catch {
    // user not authenticated
  }

  return (
    <Document>
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
            <a href={routes.cart.index.href()}>Cart</a>$
            {user ? (
              <>
                <a href={routes.account.index.href()}>Account</a>
                {user.role === 'admin' ? <a href={routes.admin.index.href()}>Admin</a> : null}
                <form
                  method="POST"
                  action={routes.auth.logout.href()}
                  style={{ display: 'inline' }}
                >
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    style={{ marginLeft: '1rem' }}
                  >
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
        <div className="container">{children}</div>
      </main>
      <footer>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Bookstore Demo. Built with Remix.</p>
        </div>
      </footer>
    </Document>
  )
}
