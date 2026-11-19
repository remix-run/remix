import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { BookWithCover } from '../../utils/book-images.ts'
import { getBookGenreLabel } from '../../data/book-genres.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { BookCard, BookCoverPreload } from '../../ui/book-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface IndexPageProps {
  allBooks: BookWithCover[]
  genres: string[]
  cart: Cart
}

export function IndexPage(handle: Handle<IndexPageProps>) {
  return () => {
    let { allBooks, cart, genres } = handle.props

    return (
      <Layout head={<BookCoverPreload book={allBooks[0]} />}>
        <h1>Browse Books</h1>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <form
            action={routes.search.href()}
            method="GET"
            mix={css({ display: 'flex', gap: '0.5rem' })}
          >
            <input
              type="search"
              name="q"
              placeholder="Search books by title, author, or description..."
              mix={css({ flex: 1, padding: '0.5rem' })}
            />
            <button type="submit" class="btn">
              Search
            </button>
          </form>
        </div>

        <div class="card" mix={css({ marginBottom: '2rem' })}>
          <h3>Browse by Category</h3>
          <div mix={css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' })}>
            {genres.map((genre) => (
              <a
                data-rmx-prefetch="intent"
                href={routes.books.genre.href({ genre })}
                class="btn btn-secondary"
              >
                {getBookGenreLabel(genre)}
              </a>
            ))}
          </div>
        </div>

        <div class="grid">
          {allBooks.map((book, index) => {
            let inCart = cart.items.some((item) => item.slug === book.slug)
            return (
              <BookCard book={book} inCart={inCart} imageLoading={index < 4 ? 'eager' : 'lazy'} />
            )
          })}
        </div>
      </Layout>
    )
  }
}
