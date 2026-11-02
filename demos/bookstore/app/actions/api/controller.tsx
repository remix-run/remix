import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

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
    async cartToggle({ db, formData, request, session }) {
      let { bookId } = s.parse(bookIdSchema, formData)
      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let cart = getCurrentCart(session)
      let inCart = cart.items.some((item) => item.bookId === book.id)

      let next = inCart
        ? removeFromCart(cart, book.id)
        : addToCart(cart, book.id, book.slug, book.title, book.price, 1)

      session.set('cart', next)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // The button's form loads into its own frame, which names itself in `X-Remix-Target`.
      if (request.headers.has('X-Remix-Target')) {
        return redirect(routes.fragments.cartButton.href({ bookId: book.id }))
      }
      // Without the client runtime, the form submits the whole page, so return to it.
      let referrer = URL.parse(request.headers.get('Referer') ?? '')
      return redirect(
        referrer?.origin === new URL(request.url).origin
          ? referrer.href
          : routes.books.show.href({ slug: book.slug }),
      )
    },
  },
})
