import { css } from 'remix/component'

import type { Book } from '../../data/schema.ts'
import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { BookCard } from '../ui/book-card.tsx'
import { Layout } from '../ui/layout.tsx'

export interface SearchPageProps {
  query: string
  matchingBooks: Book[]
  cart: Cart
}

export function SearchPage() {
  return ({ cart, matchingBooks, query }: SearchPageProps) => (
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
    </Layout>
  )
}
