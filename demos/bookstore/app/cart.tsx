import type { Controller, RequestContext } from 'remix/fetch-router'
import { Frame } from 'remix/component'
import { redirect } from 'remix/response/redirect'

import { routes } from './routes.ts'

import { books } from './data/schema.ts'
import { addToCart, removeFromCart, updateCartItem } from './data/cart.ts'
import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
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
      async add({ db, session, formData }) {
        if (process.env.NODE_ENV !== 'test') {
          // Simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        let book = await db.find(books, formData.get('bookId') as string)
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

      async update({ db, session, formData }) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        let book = await db.find(books, formData.get('bookId') as string)
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

      async remove({ db, session, formData }) {
        if (process.env.NODE_ENV !== 'test') {
          // Simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        let book = await db.find(books, formData.get('bookId') as string)
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
} satisfies Controller<typeof routes.cart>

export async function toggleCart({ db, session, formData }: RequestContext<'POST'>) {
  let book = await db.find(books, formData.get('bookId') as string)
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
