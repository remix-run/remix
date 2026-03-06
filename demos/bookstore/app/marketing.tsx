import type { BuildAction, Controller } from 'remix/fetch-router'
import { css } from 'remix/component'

import { routes } from './routes.ts'
import { BookCard } from './components/book-card.tsx'
import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { ilike, inList, or } from 'remix/data-table'
import { books } from './data/schema.ts'
import { render } from './utils/render.ts'
import { getCurrentCart } from './utils/context.ts'

export let home: BuildAction<'GET', typeof routes.home> = {
  middleware: [loadAuth()],
  async action({ db }) {
    let cart = getCurrentCart()
    let featuredSlugs = ['bbq', 'heavy-metal', 'three-ways']
    let featuredBookRows = await db.findMany(books, {
      where: inList('slug', featuredSlugs),
    })
    let featuredBooksBySlug = new Map(featuredBookRows.map((book) => [book.slug, book]))
    let featuredBooks = featuredSlugs.flatMap((slug) => {
      let book = featuredBooksBySlug.get(slug)
      return book ? [book] : []
    })

    return render(
      <Layout>
        <div class="card">
          <h1>Welcome to the Bookstore</h1>
          <p mix={[css({ margin: '1rem 0' })]}>
            Discover your next favorite book from our curated collection of fiction, non-fiction,
            and more.
          </p>
          <p>
            <a href={routes.books.index.href()} class="btn">
              Browse Books
            </a>
          </p>
        </div>

        <h2 mix={[css({ margin: '2rem 0 1rem' })]}>Featured Books</h2>
        <div class="grid">
          {featuredBooks.map((book) => {
            let inCart = cart.items.some((item) => item.slug === book.slug)
            return <BookCard book={book} inCart={inCart} />
          })}
        </div>
      </Layout>,
      { headers: { 'Cache-Control': 'no-store' } },
    )
  },
}

export let about: BuildAction<'GET', typeof routes.about> = {
  middleware: [loadAuth()],
  action() {
    return render(
      <Layout>
        <div class="card">
          <h1>About Our Bookstore</h1>
          <p mix={[css({ margin: '1rem 0' })]}>
            Welcome to our online bookstore, a demo application built to showcase the capabilities
            of
            <strong>fetch-router</strong> - a powerful, type-safe routing library for web
            applications.
          </p>

          <h2 mix={[css({ margin: '1.5rem 0 0.5rem' })]}>What This Demo Shows</h2>
          <ul mix={[css({ marginLeft: '2rem', lineHeight: 2 })]}>
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

          <h2 mix={[css({ margin: '1.5rem 0 0.5rem' })]}>Try It Out</h2>
          <p mix={[css({ margin: '1rem 0' })]}>
            Explore the site to see all these features in action. You can browse books, create an
            account, add items to your cart, and even access the admin panel (login as
            admin@bookstore.com / admin123).
          </p>

          <p mix={[css({ marginTop: '2rem' })]}>
            <a href={routes.books.index.href()} class="btn">
              Explore Books
            </a>
            <a
              href={routes.auth.register.index.href()}
              class="btn btn-secondary"
              mix={[css({ marginLeft: '1rem' })]}
            >
              Create Account
            </a>
          </p>
        </div>
      </Layout>,
    )
  },
}

export let contact: Controller<typeof routes.contact> = {
  middleware: [loadAuth()],
  actions: {
    index() {
      return render(
        <Layout>
          <div class="card">
            <h1>Contact Us</h1>
            <p mix={[css({ margin: '1rem 0' })]}>
              Have a question or feedback? We'd love to hear from you!
            </p>

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

export let search: BuildAction<'GET', typeof routes.search> = {
  middleware: [loadAuth()],
  async action({ db, url }) {
    let query = url.searchParams.get('q') ?? ''
    let matchingBooks = query
      ? await db.findMany(books, {
          where: or(
            ilike('title', `%${query.toLowerCase()}%`),
            ilike('author', `%${query.toLowerCase()}%`),
            ilike('description', `%${query.toLowerCase()}%`),
          ),
          orderBy: ['id', 'asc'],
        })
      : []
    let cart = getCurrentCart()

    return render(
      <Layout>
        <h1>Search Results</h1>

        <div class="card" mix={[css({ marginBottom: '2rem' })]}>
          <form
            action={routes.search.href()}
            method="GET"
            mix={[css({ display: 'flex', gap: '0.5rem' })]}
          >
            <input
              type="search"
              name="q"
              placeholder="Search books..."
              value={query}
              mix={[css({ flex: 1, padding: '0.5rem' })]}
            />
            <button type="submit" class="btn">
              Search
            </button>
          </form>
        </div>

        {query ? (
          <p mix={[css({ marginBottom: '1rem' })]}>
            Found {matchingBooks.length} result(s) for "{query}"
          </p>
        ) : null}

        <div class="grid">
          {matchingBooks.length > 0 ? (
            matchingBooks.map((book) => {
              let inCart = cart.items.some((item) => item.slug === book.slug)
              return <BookCard book={book} inCart={inCart} />
            })
          ) : (
            <p>No books found matching your search.</p>
          )}
        </div>
      </Layout>,
    )
  },
}
