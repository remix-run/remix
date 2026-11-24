import { createController } from 'remix/router'
import { ilike, or } from 'remix/data-table'
import { createFileResponse as sendFile } from 'remix/response/file'

import { books } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { resolveBookCover } from '../utils/book-images.ts'
import { uploadsStorage } from '../utils/uploads.ts'
import { browsingResponseInit } from './browsing-response.ts'
import { AboutPage } from './about.tsx'
import { HomePage } from './home.tsx'
import { SearchPage } from './search.tsx'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
    async uploads({ request, params }) {
      let file = await uploadsStorage.get(params.key)

      if (!file) {
        return new Response('File not found', { status: 404 })
      }

      return sendFile(file, request, {
        cacheControl: 'public, max-age=31536000',
      })
    },
    async home({ db, render, request }) {
      let bookRows = await db.findMany(books, { orderBy: ['id', 'asc'], limit: 4 })
      let featuredBooks = await Promise.all(bookRows.map(resolveBookCover))

      return render(<HomePage featuredBooks={featuredBooks} />, browsingResponseInit(request))
    },
    about({ render, request }) {
      return render(<AboutPage />, browsingResponseInit(request))
    },
    async search({ db, render, request, url }) {
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
      matchingBooks = await Promise.all(matchingBooks.map(resolveBookCover))

      return render(
        <SearchPage query={query} matchingBooks={matchingBooks} />,
        browsingResponseInit(request),
      )
    },
  },
})
