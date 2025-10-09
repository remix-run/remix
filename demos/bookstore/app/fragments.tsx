import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'

import { BookCard } from './components/book-card.tsx'
import { loadAuth, SESSION_ID_KEY } from './middleware/auth.ts'
import { getCart } from './models/cart.ts'
import { getBookBySlug } from './models/books.ts'
import { getStorage } from './utils/context.ts'
import { render } from './utils/render.ts'

export default {
  use: [loadAuth],
  handlers: {
    async bookCard({ params }) {
      // Simulate network latency
      // await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()))

      let book = getBookBySlug(params.slug)

      if (!book) {
        return render(<div>Book not found</div>, { status: 404 })
      }

      let cart = getCart(getStorage().get(SESSION_ID_KEY))
      let inCart = cart.items.some((item) => item.slug === params.slug)

      return render(<BookCard book={book} inCart={inCart} />)
    },
  },
} satisfies RouteHandlers<typeof routes.fragments>
