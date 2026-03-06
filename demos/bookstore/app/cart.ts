import { html } from 'remix/component/tag'
import type { Controller, RequestContext } from 'remix/fetch-router'
import { Frame } from 'remix/component'
import { redirect } from 'remix/response/redirect'

import { routes } from './routes.ts'

import { books } from './data/schema.ts'
import { addToCart, removeFromCart, updateCartItem } from './data/cart.ts'
import { Layout } from './layout.ts'
import { loadAuth } from './middleware/auth.ts'
import { getCurrentCart } from './utils/context.ts'
import { parseId } from './utils/ids.ts'
import { render } from './utils/render.ts'
import { Session } from './utils/session.ts'

export default {
  middleware: [loadAuth()],
  actions: {
    index() {
      return render(
        html`<${Layout}>
          <h1>Shopping Cart</h1>

          <div class="card">
            <${Frame} name="cart" src=${routes.fragments.cartItems.href()} />
          </div>
        <//>`,
      )
    },

    api: {
      actions: {
        async add({ db, get }) {
          let session = get(Session)
          let formData = get(FormData)
          if (process.env.NODE_ENV !== 'test') {
            // Simulate network latency
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }

          let bookId = parseId(formData.get('bookId'))
          let book = bookId === undefined ? undefined : await db.find(books, bookId)
          if (!book) {
            return new Response('Book not found', { status: 404 })
          }

          session.set(
            'cart',
            addToCart(getCurrentCart(), book.id, book.slug, book.title, book.price, 1),
          )

          if (formData.get('redirect') === 'none') {
            return new Response(null, { status: 204 })
          }

          return redirect(routes.cart.index.href())
        },

        async update({ db, get }) {
          let session = get(Session)
          let formData = get(FormData)
          await new Promise((resolve) => setTimeout(resolve, 1000))

          let bookId = parseId(formData.get('bookId'))
          let book = bookId === undefined ? undefined : await db.find(books, bookId)
          if (!book) {
            return new Response('Book not found', { status: 404 })
          }

          let quantity = parseInt(formData.get('quantity')?.toString() ?? '1', 10)

          session.set('cart', updateCartItem(getCurrentCart(), book.id, quantity))

          if (formData.get('redirect') === 'none') {
            return new Response(null, { status: 204 })
          }

          return redirect(routes.cart.index.href())
        },

        async remove({ db, get }) {
          let session = get(Session)
          let formData = get(FormData)
          if (process.env.NODE_ENV !== 'test') {
            // Simulate network latency
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }

          let bookId = parseId(formData.get('bookId'))
          let book = bookId === undefined ? undefined : await db.find(books, bookId)
          if (!book) {
            return new Response('Book not found', { status: 404 })
          }

          session.set('cart', removeFromCart(getCurrentCart(), book.id))

          if (formData.get('redirect') === 'none') {
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
  let bookId = parseId(formData.get('bookId'))
  let book = bookId === undefined ? undefined : await db.find(books, bookId)
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
