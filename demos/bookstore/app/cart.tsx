import type { Controller, RequestContext } from 'remix/fetch-router'
import { Frame } from 'remix/component'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { routes } from './routes.ts'

import { books } from './data/schema.ts'
import { addToCart, removeFromCart, updateCartItem } from './data/cart.ts'
import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { getCurrentCart } from './utils/context.ts'
import { parseId } from './utils/ids.ts'
import { render } from './utils/render.ts'
import { Session } from './utils/session.ts'

const bookIdField = f.field(s.optional(s.string()))
const quantityField = f.field(s.defaulted(s.optional(s.string()), '1'))
const redirectField = f.field(s.optional(s.string()))
const bookIdSchema = f.object({
  bookId: bookIdField,
})
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
  middleware: [loadAuth()],
  actions: {
    index() {
      return render(
        <Layout>
          <h1>Shopping Cart</h1>

          <div class="card">
            <Frame name="cart" src={routes.fragments.cartItems.href()} />
          </div>
        </Layout>,
      )
    },

    api: {
      actions: {
        async add({ db, get }) {
          let session = get(Session)
          let formData = get(FormData)
          let { bookId, redirect: redirectTo } = s.parse(cartActionSchema, formData)
          if (process.env.NODE_ENV !== 'test') {
            // Simulate network latency
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

        async update({ db, get }) {
          let session = get(Session)
          let formData = get(FormData)
          let { bookId, quantity, redirect: redirectTo } = s.parse(cartUpdateSchema, formData)
          await new Promise((resolve) => setTimeout(resolve, 1000))

          let parsedBookId = parseId(bookId)
          let book = parsedBookId === undefined ? undefined : await db.find(books, parsedBookId)
          if (!book) {
            return new Response('Book not found', { status: 404 })
          }

          let nextQuantity = parseInt(quantity ?? '1', 10)

          session.set('cart', updateCartItem(getCurrentCart(), book.id, nextQuantity))

          if (redirectTo === 'none') {
            return new Response(null, { status: 204 })
          }

          return redirect(routes.cart.index.href())
        },

        async remove({ db, get }) {
          let session = get(Session)
          let formData = get(FormData)
          let { bookId, redirect: redirectTo } = s.parse(cartActionSchema, formData)
          if (process.env.NODE_ENV !== 'test') {
            // Simulate network latency
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
    },
  },
} satisfies Controller<typeof routes.cart>

export async function toggleCart({ db, get }: RequestContext) {
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
}
