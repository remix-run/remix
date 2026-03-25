import type { BuildAction } from 'remix/fetch-router'
import { css } from 'remix/component'
import { Database, ilike, or } from 'remix/data-table'

import type { Book } from '../data/schema.ts'
import { books } from '../data/schema.ts'
import { routes } from '../routes.ts'
import type { Cart } from '../utils/cart.ts'
import { getCurrentCart } from '../utils/context.ts'
import { render } from '../utils/render.tsx'
import { BookCard } from '../ui/book-card.tsx'
import { Layout } from '../ui/layout.tsx'

export const search: BuildAction<'GET', typeof routes.search> = {
  async handler({ get, url }) {
    let db = get(Database)
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

    return render(<SearchPage query={query} matchingBooks={matchingBooks} cart={cart} />)
  },
}

interface SearchPageProps {
  query: string
  matchingBooks: Book[]
  cart: Cart
}

function SearchPage() {
  return ({ cart, matchingBooks, query }: SearchPageProps) => (
    <Layout>
      <h1>Search Results</h1>

      <div class="card" mix={css({ marginBottom: '2rem' })}>
        <form
          action={routes.search.href()}
          method="GET"
          mix={css({ display: 'flex', gap: '0.5rem' })}
        >
          <input
            type="search"
            name="q"
            placeholder="Search books..."
            value={query}
            mix={css({ flex: 1, padding: '0.5rem' })}
          />
          <button type="submit" class="btn">
            Search
          </button>
        </form>
      </div>

      {query ? (
        <p mix={css({ marginBottom: '1rem' })}>
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
