import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'
import { Frame } from 'remix/component'

import { routes } from './routes.ts'

import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { getBookById } from './models/books.ts'
import { addToCart, updateCartItem, removeFromCart } from './models/cart.ts'
import { getCurrentCart } from './utils/context.ts'
import { render } from './utils/render.ts'

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
      async add({ session, formData }) {
        if (process.env.NODE_ENV !== 'test') {
          // Simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        let bookId = parseBookId(formData.get('bookId'))
        if (bookId === null) {
          return new Response('Invalid book id', { status: 400 })
        }

        let book = await getBookById(String(bookId))
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

      async update({ session, formData }) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        let bookId = parseBookId(formData.get('bookId'))
        if (bookId === null) {
          return new Response('Invalid book id', { status: 400 })
        }

        let quantity = parseInt(formData.get('quantity')?.toString() ?? '1', 10)

        session.set('cart', updateCartItem(getCurrentCart(), bookId, quantity))

        if (formData.get('redirect') === 'none') {
          return new Response(null, { status: 204 })
        }

        return redirect(routes.cart.index.href())
      },

      async remove({ session, formData }) {
        if (process.env.NODE_ENV !== 'test') {
          // Simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        let bookId = parseBookId(formData.get('bookId'))
        if (bookId === null) {
          return new Response('Invalid book id', { status: 400 })
        }

        session.set('cart', removeFromCart(getCurrentCart(), bookId))

        if (formData.get('redirect') === 'none') {
          return new Response(null, { status: 204 })
        }

        return redirect(routes.cart.index.href())
      },
    },
  },
} satisfies Controller<typeof routes.cart>

export async function toggleCart({ session, formData }: any) {
  let bookId = parseBookId(formData.get('bookId'))
  if (bookId === null) {
    return new Response('Invalid book id', { status: 400 })
  }

  let book = await getBookById(String(bookId))
  if (!book) return new Response('Book not found', { status: 404 })

  let cart = getCurrentCart()
  let inCart = cart.items.some((item) => item.bookId === book.id)

  let next = inCart
    ? removeFromCart(cart, book.id)
    : addToCart(cart, book.id, book.slug, book.title, book.price, 1)

  session.set('cart', next)

  return new Response(null, { status: 204 })
}

function parseBookId(value: unknown): number | null {
  let stringValue = typeof value === 'string' ? value : value?.toString()
  if (!stringValue) {
    return null
  }

  let parsed = Number(stringValue)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}
