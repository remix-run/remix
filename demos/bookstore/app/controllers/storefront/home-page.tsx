import { css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { BookCard } from '../ui/book-card.tsx'
import { Layout } from '../ui/layout.tsx'

export interface HomePageProps {
  featuredBooks: Book[]
  cart: Cart
}

export function HomePage() {
  return ({ featuredBooks, cart }: HomePageProps) => (
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
    </Layout>
  )
}
