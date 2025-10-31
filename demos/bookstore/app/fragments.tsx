import type { RouteHandlers } from '@remix-run/fetch-router'

import type { routes } from '../routes.ts'

import { BookCard } from './components/book-card.tsx'
import { loadAuth } from './middleware/auth.ts'
import { getCart } from './models/cart.ts'
import { getBookBySlug } from './models/books.ts'
import { render } from './utils/render.ts'

export default {
  use: [loadAuth],
  handlers: {
    async bookCard({ session, params }) {
      // Simulate network latency
      // await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()))

      let book = getBookBySlug(params.slug)

      if (!book) {
        return render(<div>Book not found</div>, { status: 404 })
      }

      let cartId = session.get('cartId')
      let cart = cartId ? getCart(cartId) : null
      let inCart = cart?.items.some((item) => item.slug === params.slug) === true

      return render(<BookCard book={book} inCart={inCart} />)
    },
  },
} satisfies RouteHandlers<typeof routes.fragments>
