import type { BuildRouteHandler, RouteHandlers } from '@remix-run/fetch-router'
import { Frame } from '@remix-run/dom'

import { routes } from './routes.ts'

import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { searchBooks } from './models/books.ts'
import { render } from './utils/render.ts'

export let home: BuildRouteHandler<'GET', typeof routes.home> = {
  middleware: [loadAuth()],
  handler() {
    return render(
      <Layout>
        <div class="card">
          <h1>Welcome to the Bookstore</h1>
          <p style="margin: 1rem 0;">
            Discover your next favorite book from our curated collection of fiction, non-fiction,
            and more.
          </p>
          <p>
            <a href={routes.books.index.href()} class="btn">
              Browse Books
            </a>
          </p>
        </div>

        <h2 style="margin: 2rem 0 1rem;">Featured Books</h2>
        <div class="grid">
          <Frame src={routes.fragments.bookCard.href({ slug: 'bbq' })} />
          <Frame src={routes.fragments.bookCard.href({ slug: 'heavy-metal' })} />
          <Frame src={routes.fragments.bookCard.href({ slug: 'three-ways' })} />
        </div>
      </Layout>,
    )
  },
}

export let about: BuildRouteHandler<'GET', typeof routes.about> = {
  middleware: [loadAuth()],
  handler() {
    return render(
      <Layout>
        <div class="card">
          <h1>About Our Bookstore</h1>
          <p style="margin: 1rem 0;">
            Welcome to our online bookstore, a demo application built to showcase the capabilities
            of
            <strong>fetch-router</strong> - a powerful, type-safe routing library for web
            applications.
          </p>

          <h2 style="margin: 1.5rem 0 0.5rem;">What This Demo Shows</h2>
          <ul style="margin-left: 2rem; line-height: 2;">
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

          <h2 style="margin: 1.5rem 0 0.5rem;">Try It Out</h2>
          <p style="margin: 1rem 0;">
            Explore the site to see all these features in action. You can browse books, create an
            account, add items to your cart, and even access the admin panel (login as
            admin@bookstore.com / admin123).
          </p>

          <p style="margin-top: 2rem;">
            <a href={routes.books.index.href()} class="btn">
              Explore Books
            </a>
            <a
              href={routes.auth.register.index.href()}
              class="btn btn-secondary"
              style="margin-left: 1rem;"
            >
              Create Account
            </a>
          </p>
        </div>
      </Layout>,
    )
  },
}

export let contact: RouteHandlers<typeof routes.contact> = {
  middleware: [loadAuth()],
  handlers: {
    index() {
      return render(
        <Layout>
          <div class="card">
            <h1>Contact Us</h1>
            <p style="margin: 1rem 0;">Have a question or feedback? We'd love to hear from you!</p>

            <form method="POST" action={routes.contact.action.href()}>
              <div class="form-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" required />
              </div>

              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required />
              </div>

              <div class="form-group">
                <label for="message">Message</label>
                <textarea id="message" name="message" required></textarea>
              </div>

              <button type="submit" class="btn">
                Send Message
              </button>
            </form>
          </div>
        </Layout>,
      )
    },

    async action() {
      return render(
        <Layout>
          <div class="alert alert-success">
            Thank you for your message! We'll get back to you soon.
          </div>
          <div class="card">
            <p>
              <a href={routes.home.href()} class="btn">
                Return Home
              </a>
            </p>
          </div>
        </Layout>,
      )
    },
  },
}

export let search: BuildRouteHandler<'GET', typeof routes.search> = {
  middleware: [loadAuth()],
  handler({ url }) {
    let query = url.searchParams.get('q') ?? ''
    let books = query ? searchBooks(query) : []

    return render(
      <Layout>
        <h1>Search Results</h1>

        <div class="card" style="margin-bottom: 2rem;">
          <form action={routes.search.href()} method="GET" style="display: flex; gap: 0.5rem;">
            <input
              type="search"
              name="q"
              placeholder="Search books..."
              value={query}
              css={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit" class="btn">
              Search
            </button>
          </form>
        </div>

        {query ? (
          <p style="margin-bottom: 1rem;">
            Found {books.length} result(s) for "{query}"
          </p>
        ) : null}

        <div class="grid">
          {books.length > 0 ? (
            books.map((book) => <Frame src={routes.fragments.bookCard.href({ slug: book.slug })} />)
          ) : (
            <p>No books found matching your search.</p>
          )}
        </div>
      </Layout>,
    )
  },
}
