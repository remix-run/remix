import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { books } from '../../../data/schema.ts'
import { Session } from '../../../middleware/session.ts'
import { routes } from '../../../routes.ts'
import { addToCart, removeFromCart, updateCartItem } from '../../../utils/cart.ts'
import { getCurrentCart } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'

const bookIdField = f.field(s.optional(s.string()))
const quantityField = f.field(s.defaulted(s.string(), '1'))
const redirectField = f.field(s.optional(s.string()))
const cartActionSchema = f.object({
  bookId: bookIdField,
  redirect: redirectField,
})
const cartUpdateSchema = f.object({
  bookId: bookIdField,
  quantity: quantityField,
  redirect: redirectField,
})

export default {
  actions: {
    async add({ get }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
      let { bookId, redirect: redirectTo } = s.parse(cartActionSchema, formData)
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
        addToCart(getCurrentCart(), book.id, book.slug, book.title, book.price, 1),
      )

      if (redirectTo === 'none') {
        return new Response(null, { status: 204 })
      }

      return redirect(routes.cart.index.href())
    },

    async update({ get }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
      let { bookId, quantity, redirect: redirectTo } = s.parse(cartUpdateSchema, formData)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      let nextQuantity = parseInt(quantity, 10)
      session.set('cart', updateCartItem(getCurrentCart(), book.id, nextQuantity))

      if (redirectTo === 'none') {
        return new Response(null, { status: 204 })
      }

      return redirect(routes.cart.index.href())
    },

    async remove({ get }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
      let { bookId, redirect: redirectTo } = s.parse(cartActionSchema, formData)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      let parsedBookId = parseId(bookId)
      let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
      if (!book) {
        return new Response('Book not found', { status: 404 })
      }

      session.set('cart', removeFromCart(getCurrentCart(), book.id))

      if (redirectTo === 'none') {
        return new Response(null, { status: 204 })
      }

      return redirect(routes.cart.index.href())
    },
  },
} satisfies Controller<typeof routes.cart.api>
