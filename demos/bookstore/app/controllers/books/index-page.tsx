import { css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { BookCard } from '../../ui/book-card.tsx'
import { Layout } from '../../ui/layout.tsx'

export interface IndexPageProps {
  allBooks: Book[]
  genres: string[]
  cart: Cart
}

export function IndexPage() {
  return ({ allBooks, cart, genres }: IndexPageProps) => (
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
        <div mix={[css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' })]}>
          {genres.map((genre) => (
            <a href={routes.books.genre.href({ genre })} class="btn btn-secondary">
              {genre}
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
    </Layout>
  )
}
