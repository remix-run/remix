import type { RouteHandlers } from '@remix-run/fetch-router'

import type { routes } from './routes.ts'
import { BookCard } from './components/book-card.tsx'
import { loadAuth } from './middleware/auth.ts'
import { getBookBySlug } from './models/books.ts'
import { render } from './utils/render.ts'
import { getCurrentCart } from './utils/context.ts'

export default {
  middleware: [loadAuth()],
  handlers: {
    async bookCard({ params }) {
      // Simulate network latency
      // await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()))

      let book = getBookBySlug(params.slug)

      if (!book) {
        return render(<div>Book not found</div>, { status: 404 })
      }

      let cart = getCurrentCart()
      let inCart = cart.items.some((item) => item.slug === params.slug)

      return render(<BookCard book={book} inCart={inCart} />)
    },
  },
} satisfies RouteHandlers<typeof routes.fragments>
