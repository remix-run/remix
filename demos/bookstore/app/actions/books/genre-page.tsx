import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { BookWithCover } from '../../utils/book-images.ts'
import { getBookGenreLabel } from '../../data/book-genres.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { BookCard } from '../../ui/book-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface GenrePageProps {
  genre: string
  matchingBooks: BookWithCover[]
  cart: Cart
}

export function GenrePage(handle: Handle<GenrePageProps>) {
  return () => {
    let { cart, genre, matchingBooks } = handle.props

    return (
      <Layout>
        <h1>{getBookGenreLabel(genre)}</h1>
        <p mix={css({ margin: '1rem 0' })}>
          <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn btn-secondary">
            View All Books
          </a>
        </p>

        <div class="grid" mix={css({ marginTop: '2rem' })}>
          {matchingBooks.map((book, index) => {
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

export function GenreNotFoundPage(handle: Handle<{ genre: string }>) {
  return () => (
    <Layout>
      <div class="card">
        <h1>Category Not Found</h1>
        <p>No books found in the "{handle.props.genre}" category.</p>
        <p mix={css({ marginTop: '1rem' })}>
          <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn">
            Browse All Books
          </a>
        </p>
      </div>
    </Layout>
  )
}
