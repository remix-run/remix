import type { Controller } from 'remix'
import { Frame } from '@remix-run/dom'

import { routes } from './routes.ts'
import { getAllBooks, getBookBySlug, getBooksByGenre, getAvailableGenres } from './models/books.ts'
import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { render } from './utils/render.ts'
import { ImageCarousel } from './assets/image-carousel.tsx'

export default {
  middleware: [loadAuth()],
  actions: {
    index() {
      let books = getAllBooks()
      let genres = getAvailableGenres()

      return render(
        <Layout>
          <h1>Browse Books</h1>

          <div class="card" style="margin-bottom: 2rem;">
            <form action={routes.search.href()} method="GET" style="display: flex; gap: 0.5rem;">
              <input
                type="search"
                name="q"
                placeholder="Search books by title, author, or description..."
                css={{ flex: 1, padding: '0.5rem' }}
              />
              <button type="submit" class="btn">
                Search
              </button>
            </form>
          </div>

          <div class="card" style="margin-bottom: 2rem;">
            <h3>Browse by Genre</h3>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
              {genres.map((genre) => (
                <a href={routes.books.genre.href({ genre })} class="btn btn-secondary">
                  {genre}
                </a>
              ))}
            </div>
          </div>

          <div class="grid">
            {books.map((book) => (
              <Frame
                fallback={<div>Loading...</div>}
                src={routes.fragments.bookCard.href({ slug: book.slug })}
              />
            ))}
          </div>
        </Layout>,
      )
    },

    genre({ params }) {
      let genre = params.genre
      let books = getBooksByGenre(genre)

      if (books.length === 0) {
        return render(
          <Layout>
            <div class="card">
              <h1>Genre Not Found</h1>
              <p>No books found in the "{genre}" genre.</p>
              <p style="margin-top: 1rem;">
                <a href={routes.books.index.href()} class="btn">
                  Browse All Books
                </a>
              </p>
            </div>
          </Layout>,
          { status: 404 },
        )
      }

      return render(
        <Layout>
          <h1>{genre.charAt(0).toUpperCase() + genre.slice(1)} Books</h1>
          <p style="margin: 1rem 0;">
            <a href={routes.books.index.href()} class="btn btn-secondary">
              View All Books
            </a>
          </p>

          <div class="grid" style="margin-top: 2rem;">
            {books.map((book) => (
              <Frame
                fallback={<div>Loading...</div>}
                src={routes.fragments.bookCard.href({ slug: book.slug })}
              />
            ))}
          </div>
        </Layout>,
      )
    },

    show({ params }) {
      let book = getBookBySlug(params.slug)

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

      return render(
        <Layout>
          <div style="display: grid; grid-template-columns: 300px 1fr; gap: 2rem;">
            <div
              css={{
                height: '400px',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              <ImageCarousel images={book.imageUrls} />
            </div>

            <div class="card">
              <h1>{book.title}</h1>
              <p class="author" style="font-size: 1.2rem; margin: 0.5rem 0;">
                by {book.author}
              </p>

              <p style="margin: 1rem 0;">
                <span class="badge badge-info">{book.genre}</span>
                <span
                  class={`badge ${book.inStock ? 'badge-success' : 'badge-warning'}`}
                  style="margin-left: 0.5rem;"
                >
                  {book.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </p>

              <p class="price" style="font-size: 2rem; margin: 1rem 0;">
                ${book.price.toFixed(2)}
              </p>

              <p style="margin: 1.5rem 0; line-height: 1.8;">{book.description}</p>

              <div style="margin: 1.5rem 0; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                <p>
                  <strong>ISBN:</strong> {book.isbn}
                </p>
                <p>
                  <strong>Published:</strong> {book.publishedYear}
                </p>
              </div>

              {book.inStock ? (
                <form method="POST" action={routes.cart.api.add.href()} style="margin-top: 2rem;">
                  <input type="hidden" name="bookId" value={book.id} />
                  <input type="hidden" name="slug" value={book.slug} />
                  <button
                    type="submit"
                    class="btn"
                    style="font-size: 1.1rem; padding: 0.75rem 1.5rem;"
                  >
                    Add to Cart
                  </button>
                </form>
              ) : (
                <p style="color: #e74c3c; font-weight: 500;">
                  This book is currently out of stock.
                </p>
              )}

              <p style="margin-top: 1.5rem;">
                <a href={routes.books.index.href()} class="btn btn-secondary">
                  Back to Books
                </a>
              </p>
            </div>
          </div>
        </Layout>,
      )
    },
  },
} satisfies Controller<typeof routes.books>
