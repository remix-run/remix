import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'

import { books } from '../../data/schema.ts'
import { Session } from '../../middleware/session.ts'
import type { routes } from '../../routes.ts'
import { addToCart, removeFromCart } from '../../utils/cart.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'

let bookIdField = f.field(s.optional(s.string()))
let bookIdSchema = f.object({
  bookId: bookIdField,
})

export default {
  actions: {
    async cartToggle({ get }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
      let { bookId } = s.parse(bookIdSchema, formData)
      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let cart = getCurrentCart()
      let inCart = cart.items.some((item) => item.bookId === book.id)

      let next = inCart
        ? removeFromCart(cart, book.id)
        : addToCart(cart, book.id, book.slug, book.title, book.price, 1)

      session.set('cart', next)

      return new Response(null, { status: 204 })
    },
  },
} satisfies Controller<typeof routes.api>
