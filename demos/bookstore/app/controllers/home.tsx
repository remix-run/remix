import type { BuildAction } from 'remix/fetch-router'
import { css } from 'remix/ui'
import { Database, inList } from 'remix/data-table'

import type { Book } from '../data/schema.ts'
import { books } from '../data/schema.ts'
import { routes } from '../routes.ts'
import type { Cart } from '../utils/cart.ts'
import { getCurrentCart } from '../utils/context.ts'
import { render } from '../utils/render.tsx'
import { BookCard } from '../ui/book-card.tsx'
import { Layout } from '../ui/layout.tsx'

export const home: BuildAction<'GET', typeof routes.home> = {
  async handler({ get }) {
    let db = get(Database)
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

    return render(<HomePage featuredBooks={featuredBooks} cart={cart} />, {
      headers: { 'Cache-Control': 'no-store' },
    })
  },
}

interface HomePageProps {
  featuredBooks: Book[]
  cart: Cart
}

function HomePage() {
  return ({ featuredBooks, cart }: HomePageProps) => (
    <Layout>
      <div class="card">
        <h1>Welcome to the Bookstore</h1>
        <p mix={css({ margin: '1rem 0' })}>
          Discover your next favorite book from our curated collection of fiction, non-fiction, and
          more.
        </p>
        <p>
          <a href={routes.books.index.href()} class="btn">
            Browse Books
          </a>
        </p>
      </div>

      <h2 mix={css({ margin: '2rem 0 1rem' })}>Featured Books</h2>
      <div class="grid">
        {featuredBooks.map((book) => {
          let inCart = cart.items.some((item) => item.slug === book.slug)
          return <BookCard book={book} inCart={inCart} />
        })}
      </div>
    </Layout>
  )
}
