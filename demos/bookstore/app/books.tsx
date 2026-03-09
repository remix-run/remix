import type { Controller } from 'remix/fetch-router'
import { Frame, css } from 'remix/component'

import { routes } from './routes.ts'
import { ilike } from 'remix/data-table'

import { books } from './data/schema.ts'
import { BookCard } from './components/book-card.tsx'
import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { render } from './utils/render.ts'
import { getCurrentCart } from './utils/context.ts'
import { ImageCarousel } from './assets/image-carousel.tsx'

export default {
  middleware: [loadAuth()],
  actions: {
    async index({ db }) {
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
      let genres = await db.query(books).select('genre').distinct().orderBy('genre', 'asc').all()
      let cart = getCurrentCart()

      return render(
        <Layout>
          <h1>Browse Books</h1>

          <div class="card" mix={[css({ marginBottom: '2rem' })]}>
            <form
              action={routes.search.href()}
              method="GET"
              mix={[css({ display: 'flex', gap: '0.5rem' })]}
            >
              <input
                type="search"
                name="q"
                placeholder="Search books by title, author, or description..."
                mix={[css({ flex: 1, padding: '0.5rem' })]}
              />
              <button type="submit" class="btn">
                Search
              </button>
            </form>
          </div>

          <div class="card" mix={[css({ marginBottom: '2rem' })]}>
            <h3>Browse by Genre</h3>
            <div
              mix={[css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' })]}
            >
              {genres.map((genreRow) => (
                <a
                  href={routes.books.genre.href({ genre: genreRow.genre })}
                  class="btn btn-secondary"
                >
                  {genreRow.genre}
                </a>
              ))}
            </div>
          </div>

          <div class="grid">
            {allBooks.map((book) => {
              let inCart = cart.items.some((item) => item.slug === book.slug)
              return <BookCard book={book} inCart={inCart} />
            })}
          </div>
        </Layout>,
      )
    },

    async genre({ params, db }) {
      let genre = params.genre
      let matchingBooks = await db.findMany(books, {
        where: ilike('genre', genre),
        orderBy: ['id', 'asc'],
      })

      if (matchingBooks.length === 0) {
        return render(
          <Layout>
            <div class="card">
              <h1>Genre Not Found</h1>
              <p>No books found in the "{genre}" genre.</p>
              <p mix={[css({ marginTop: '1rem' })]}>
                <a href={routes.books.index.href()} class="btn">
                  Browse All Books
                </a>
              </p>
            </div>
          </Layout>,
          { status: 404 },
        )
      }

      let cart = getCurrentCart()

      return render(
        <Layout>
          <h1>{genre.charAt(0).toUpperCase() + genre.slice(1)} Books</h1>
          <p mix={[css({ margin: '1rem 0' })]}>
            <a href={routes.books.index.href()} class="btn btn-secondary">
              View All Books
            </a>
          </p>

          <div class="grid" mix={[css({ marginTop: '2rem' })]}>
            {matchingBooks.map((book) => {
              let inCart = cart.items.some((item) => item.slug === book.slug)
              return <BookCard book={book} inCart={inCart} />
            })}
          </div>
        </Layout>,
      )
    },

    async show({ params, db }) {
      let book = await db.findOne(books, { where: { slug: params.slug } })

      if (!book) {
        return render(
          <Layout>
            <div class="card">
              <h1>Book Not Found</h1>
            </div>
          </Layout>,
          { status: 404 },
        )
      }

      let imageUrls = JSON.parse(book.image_urls) as string[]

      return render(
        <Layout>
          <div mix={[css({ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' })]}>
            <div
              mix={[
                css({
                  height: '400px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                }),
              ]}
            >
              <ImageCarousel images={imageUrls} />
            </div>

            <div class="card">
              <h1>{book.title}</h1>
              <p class="author" mix={[css({ fontSize: '1.2rem', margin: '0.5rem 0' })]}>
                by {book.author}
              </p>

              <p mix={[css({ margin: '1rem 0' })]}>
                <span class="badge badge-info">{book.genre}</span>
                <span
                  class={`badge ${book.in_stock ? 'badge-success' : 'badge-warning'}`}
                  mix={[css({ marginLeft: '0.5rem' })]}
                >
                  {book.in_stock ? 'In Stock' : 'Out of Stock'}
                </span>
              </p>

              <p class="price" mix={[css({ fontSize: '2rem', margin: '1rem 0' })]}>
                ${book.price.toFixed(2)}
              </p>

              <p mix={[css({ margin: '1.5rem 0', lineHeight: 1.8 })]}>{book.description}</p>

              <div
                mix={[
                  css({
                    margin: '1.5rem 0',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                  }),
                ]}
              >
                <p>
                  <strong>ISBN:</strong> {book.isbn}
                </p>
                <p>
                  <strong>Published:</strong> {book.published_year}
                </p>
              </div>

              {book.in_stock ? (
                <div mix={[css({ marginTop: '2rem' })]}>
                  <Frame src={routes.fragments.cartButton.href({ bookId: book.id })} />
                </div>
              ) : (
                <p mix={[css({ color: '#e74c3c', fontWeight: 500 })]}>
                  This book is currently out of stock.
                </p>
              )}

              <p mix={[css({ marginTop: '1.5rem' })]}>
                <a href={routes.books.index.href()} class="btn btn-secondary">
                  Back to Books
                </a>
              </p>
            </div>
          </div>
        </Layout>,
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
} satisfies Controller<typeof routes.books>
