import type { BuildAction } from 'remix/fetch-router'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { render } from '../utils/render.tsx'
import { Layout } from '../ui/layout.tsx'

export const about: BuildAction<'GET', typeof routes.about> = {
  handler() {
    return render(<AboutPage />)
  },
}

function AboutPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>About Our Bookstore</h1>
        <p mix={css({ margin: '1rem 0' })}>
          Welcome to our online bookstore, a demo application built to showcase the capabilities of
          <strong>fetch-router</strong> - a powerful, type-safe routing library for web
          applications.
        </p>

        <h2 mix={css({ margin: '1.5rem 0 0.5rem' })}>What This Demo Shows</h2>
        <ul mix={css({ marginLeft: '2rem', lineHeight: 2 })}>
          <li>
            <strong>Resource Routes:</strong> Full RESTful CRUD operations
          </li>
          <li>
            <strong>Nested Routes:</strong> Deep route hierarchies with type safety
          </li>
          <li>
            <strong>Custom Parameters:</strong> Flexible parameter naming (slug, orderId, etc.)
          </li>
          <li>
            <strong>HTTP Methods:</strong> GET, POST, PUT, DELETE properly used
          </li>
          <li>
            <strong>Middleware:</strong> Authentication and authorization
          </li>
          <li>
            <strong>Type Safety:</strong> End-to-end type checking for routes and handlers
          </li>
        </ul>

        <h2 mix={css({ margin: '1.5rem 0 0.5rem' })}>Try It Out</h2>
        <p mix={css({ margin: '1rem 0' })}>
          Explore the site to see all these features in action. You can browse books, create an
          account, add items to your cart, and even access the admin panel (login as
          admin@bookstore.com / admin123).
        </p>

        <p mix={css({ marginTop: '2rem' })}>
          <a href={routes.books.index.href()} class="btn">
            Explore Books
          </a>
          <a
            href={routes.auth.register.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '1rem' })}
          >
            Create Account
          </a>
        </p>
      </div>
    </Layout>
  )
}
