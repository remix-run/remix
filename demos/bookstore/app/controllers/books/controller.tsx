import type { Controller } from 'remix/fetch-router'
import { Database, ilike, query } from 'remix/data-table'
import { books } from '../../data/schema.ts'
import type { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { render } from '../render.tsx'
import { BrowsePage } from './browse-page.tsx'
import { BookDetailsPage, BookNotFoundPage } from './details-page.tsx'
import { GenreNotFoundPage, GenrePage } from './genre-page.tsx'

export default {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let allBooks = await db.exec(query(books).orderBy('id', 'asc').all())
      let genreRows = await db.exec(
        query(books).select('genre').distinct().orderBy('genre', 'asc').all(),
      )
      let cart = getCurrentCart()

      return render(
        <BrowsePage
          allBooks={allBooks}
          genres={genreRows.map((row) => row.genre)}
          cart={cart}
        />,
      )
    },

    async genre({ get, params }) {
      let db = get(Database)
      let genre = params.genre
      let matchingBooks = await db.exec(
        query(books).where(ilike('genre', genre)).orderBy('id', 'asc').all(),
      )

      if (matchingBooks.length === 0) {
        return render(<GenreNotFoundPage genre={genre} />, { status: 404 })
      }

      let cart = getCurrentCart()
      return render(<GenrePage genre={genre} matchingBooks={matchingBooks} cart={cart} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let book = await db.exec(query(books).where({ slug: params.slug }).first())

      if (!book) {
        return render(<BookNotFoundPage />, { status: 404 })
      }

      let imageUrls = JSON.parse(book.image_urls) as string[]

      return render(<BookDetailsPage book={book} imageUrls={imageUrls} />, {
        headers: { 'Cache-Control': 'no-store' },
      })
    },
  },
} satisfies Controller<typeof routes.books>
