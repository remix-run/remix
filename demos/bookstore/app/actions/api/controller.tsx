import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { addToCart, removeFromCart } from '../../utils/cart.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'

const bookIdField = f.field(s.optional(s.string()))
const bookIdSchema = f.object({
  bookId: bookIdField,
})

export default createController(routes.api, {
  actions: {
    async cartToggle({ db, formData, session }) {
      let { bookId } = s.parse(bookIdSchema, formData)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 701)))
      }
      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }
      if (book.slug === 'three-ways' && Math.random() < 0.5) {
        return new Response('Couldn’t update this book. Try again.', { status: 500 })
      }

      let cart = getCurrentCart(session)
      let inCart = cart.items.some((item) => item.bookId === book.id)

      let next = inCart
        ? removeFromCart(cart, book.id)
        : addToCart(cart, book.id, book.slug, book.title, book.price, 1)

      session.set('cart', next)

      return new Response(null, { status: 204 })
    },
  },
})
