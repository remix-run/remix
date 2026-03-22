import type { BuildAction, Controller } from 'remix/fetch-router'
import { Database, ilike, inList, or, query } from 'remix/data-table'

import { books } from '../../data/schema.ts'
import { getCurrentCart } from '../../utils/context.ts'
import type { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { AboutPage } from './about-page.tsx'
import { ContactPage, ContactSuccessPage } from './contact-page.tsx'
import { HomePage } from './home-page.tsx'
import { SearchPage } from './search-page.tsx'

export let home: BuildAction<'GET', typeof routes.home> = {
  async handler({ get }) {
    let db = get(Database)
    let cart = getCurrentCart()
    let featuredSlugs = ['bbq', 'heavy-metal', 'three-ways']
    let featuredBookRows = await db.exec(query(books).where(inList('slug', featuredSlugs)).all())
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

export let about: BuildAction<'GET', typeof routes.about> = {
  handler() {
    return render(<AboutPage />)
  },
}

export let contact: Controller<typeof routes.contact> = {
  actions: {
    index() {
      return render(<ContactPage />)
    },

    async action() {
      return render(<ContactSuccessPage />)
    },
  },
}

export let search: BuildAction<'GET', typeof routes.search> = {
  async handler({ get, url }) {
    let db = get(Database)
    let searchQuery = url.searchParams.get('q') ?? ''
    let matchingBooks = searchQuery
      ? await db.exec(
          query(books)
            .where(
              or(
                ilike('title', `%${searchQuery.toLowerCase()}%`),
                ilike('author', `%${searchQuery.toLowerCase()}%`),
                ilike('description', `%${searchQuery.toLowerCase()}%`),
              ),
            )
            .orderBy('id', 'asc')
            .all(),
        )
      : []
    let cart = getCurrentCart()

    return render(<SearchPage query={searchQuery} matchingBooks={matchingBooks} cart={cart} />)
  },
}
