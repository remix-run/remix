import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { Book } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { BookCard } from '../../ui/book-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface GenrePageProps {
  genre: string
  matchingBooks: Book[]
  cart: Cart
}

export function GenrePage(handle: Handle<GenrePageProps>) {
  return () => {
    let { cart, genre, matchingBooks } = handle.props

    return (
      <Layout>
        <h1>{genre.charAt(0).toUpperCase() + genre.slice(1)} Books</h1>
        <p mix={css({ margin: '1rem 0' })}>
          <a href={routes.books.index.href()} class="btn btn-secondary">
            View All Books
          </a>
        </p>

        <div class="grid" mix={css({ marginTop: '2rem' })}>
          {matchingBooks.map((book) => {
            let inCart = cart.items.some((item) => item.slug === book.slug)
            return <BookCard book={book} inCart={inCart} />
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
        <h1>Genre Not Found</h1>
        <p>No books found in the "{handle.props.genre}" genre.</p>
        <p mix={css({ marginTop: '1rem' })}>
          <a href={routes.books.index.href()} class="btn">
            Browse All Books
          </a>
        </p>
      </div>
    </Layout>
  )
}
