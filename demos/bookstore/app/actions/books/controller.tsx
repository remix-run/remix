import { createController } from 'remix/router'
import { ilike } from 'remix/data-table'
import * as s from 'remix/data-schema'

import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { getBookImageHref, resolveBookCover } from '../../utils/book-images.ts'
import { browsingResponseInit } from '../browsing-response.ts'
import { IndexPage } from './index-page.tsx'
import { GenreNotFoundPage, GenrePage } from './genre-page.tsx'
import { BookNotFoundPage, ShowPage } from './show-page.tsx'

export default createController(routes.books, {
  actions: {
    async index({ db, render, request, session }) {
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
      let genreRows = await db.query(books).select('genre').distinct().orderBy('genre', 'asc').all()
      let cart = getCurrentCart(session)

      return render(
        <IndexPage
          allBooks={await Promise.all(allBooks.map(resolveBookCover))}
          genres={genreRows.map((row) => row.genre)}
          cart={cart}
        />,
        browsingResponseInit(request),
      )
    },

    async genre({ db, params, render, request, session }) {
      let genre = params.genre
      let matchingBooks = await db.findMany(books, {
        where: ilike('genre', genre),
        orderBy: ['id', 'asc'],
      })

      if (matchingBooks.length === 0) {
        return render(<GenreNotFoundPage genre={genre} />, { status: 404 })
      }

      let cart = getCurrentCart(session)

      return render(
        <GenrePage
          genre={genre}
          matchingBooks={await Promise.all(matchingBooks.map(resolveBookCover))}
          cart={cart}
        />,
        browsingResponseInit(request),
      )
    },

    async show({ db, params, render, request }) {
      let book = await db.findOne(books, { where: { slug: params.slug } })

      if (!book) {
        return render(<BookNotFoundPage />, { status: 404 })
      }

      let imageUrls = await Promise.all(
        s.parse(s.array(s.string()), JSON.parse(book.image_urls)).map(getBookImageHref),
      )

      return render(<ShowPage book={book} imageUrls={imageUrls} />, browsingResponseInit(request))
    },
  },
})
