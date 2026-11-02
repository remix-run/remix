import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { books } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { addToCart, removeFromCart, updateCartItem } from '../../../utils/cart.ts'
import { getCurrentCart } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'

const bookIdField = f.field(s.optional(s.string()))
const quantityField = f.field(
  s.defaulted(
    coerce
      .number()
      .refine((quantity) => Number.isSafeInteger(quantity) && quantity > 0, 'Invalid quantity'),
    1,
  ),
)
const cartActionSchema = f.object({
  bookId: bookIdField,
})
const cartUpdateSchema = f.object({
  bookId: bookIdField,
  quantity: quantityField,
})

export default createController(routes.cart.api, {
  actions: {
    async add({ db, formData, request, session }) {
      let { bookId } = s.parse(cartActionSchema, formData)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      session.set(
        'cart',
        addToCart(getCurrentCart(session), book.id, book.slug, book.title, book.price, 1),
      )

      return redirectToCart(request)
    },

    async update({ db, formData, request, session }) {
      let result = s.parseSafe(cartUpdateSchema, formData)
      if (!result.success) {
        return new Response('Invalid cart update', { status: 400 })
      }
      let { bookId, quantity } = result.value
      await new Promise((resolve) => setTimeout(resolve, 1000))

      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let cart = updateCartItem(getCurrentCart(session), book.id, quantity)
      if (cart === undefined) {
        return new Response('Cart item not found', { status: 404 })
      }
      session.set('cart', cart)

      return redirectToCart(request)
    },

    async remove({ db, formData, request, session }) {
      let { bookId } = s.parse(cartActionSchema, formData)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      session.set('cart', removeFromCart(getCurrentCart(session), book.id))

      return redirectToCart(request)
    },
  },
})

// The cart's forms load into its frame, which names itself in `X-Remix-Target`. A submission without
// the client runtime loads the whole cart page.
function redirectToCart(request: Request): Response {
  return redirect(
    request.headers.get('X-Remix-Target') === 'cart'
      ? routes.fragments.cartItems.href()
      : routes.cart.index.href(),
  )
}
