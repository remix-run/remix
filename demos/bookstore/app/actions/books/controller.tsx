import { createController } from 'remix/router'
import { ilike } from 'remix/data-table'

import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { IndexPage } from './index-page.tsx'
import { GenreNotFoundPage, GenrePage } from './genre-page.tsx'
import { BookNotFoundPage, ShowPage } from './show-page.tsx'

export default createController(routes.books, {
  actions: {
    async index({ db, render, session }) {
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
      let genreRows = await db.query(books).select('genre').distinct().orderBy('genre', 'asc').all()
      let cart = getCurrentCart(session)

      return render(
        <IndexPage allBooks={allBooks} genres={genreRows.map((row) => row.genre)} cart={cart} />,
      )
    },

    async genre({ db, params, render, session }) {
      let genre = params.genre
      let matchingBooks = await db.findMany(books, {
        where: ilike('genre', genre),
        orderBy: ['id', 'asc'],
      })

      if (matchingBooks.length === 0) {
        return render(<GenreNotFoundPage genre={genre} />, { status: 404 })
      }

      let cart = getCurrentCart(session)

      return render(<GenrePage genre={genre} matchingBooks={matchingBooks} cart={cart} />)
    },

    async show({ db, params, render }) {
      let book = await db.findOne(books, { where: { slug: params.slug } })

      if (!book) {
        return render(<BookNotFoundPage />, { status: 404 })
      }

      let imageUrls = JSON.parse(book.image_urls) as string[]

      return render(<ShowPage book={book} imageUrls={imageUrls} />, {
        headers: { 'Cache-Control': 'no-store' },
      })
    },
  },
})
