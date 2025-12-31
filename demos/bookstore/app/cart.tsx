import type { Controller } from 'remix'
import { createRedirectResponse as redirect } from 'remix'

import { routes } from './routes.ts'

import { Layout } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { getBookById } from './models/books.ts'
import { addToCart, updateCartItem, removeFromCart, getCartTotal } from './models/cart.ts'
import { getCurrentUserSafely, getCurrentCart } from './utils/context.ts'
import { render } from './utils/render.ts'
import { RestfulForm } from './components/restful-form.tsx'

export default {
  middleware: [loadAuth()],
  actions: {
    index() {
      let cart = getCurrentCart()
      let total = getCartTotal(cart)
      let user = getCurrentUserSafely()

      return render(
        <Layout>
          <h1>Shopping Cart</h1>

          <div class="card">
            {cart.items.length > 0 ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr>
                        <td>
                          <a href={routes.books.show.href({ slug: item.slug })}>{item.title}</a>
                        </td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>
                          <RestfulForm
                            method="PUT"
                            action={routes.cart.api.update.href()}
                            style="display: inline-flex; gap: 0.5rem; align-items: center;"
                          >
                            <input type="hidden" name="bookId" value={item.bookId} />
                            <input
                              type="number"
                              name="quantity"
                              value={item.quantity}
                              min="1"
                              style="width: 70px;"
                            />
                            <button
                              type="submit"
                              class="btn btn-secondary"
                              style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                            >
                              Update
                            </button>
                          </RestfulForm>
                        </td>
                        <td>${(item.price * item.quantity).toFixed(2)}</td>
                        <td>
                          <RestfulForm
                            method="DELETE"
                            action={routes.cart.api.remove.href()}
                            style="display: inline;"
                          >
                            <input type="hidden" name="bookId" value={item.bookId} />
                            <button
                              type="submit"
                              class="btn btn-danger"
                              style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                            >
                              Remove
                            </button>
                          </RestfulForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style="text-align: right; font-weight: bold;">
                        Total:
                      </td>
                      <td style="font-weight: bold;">${total.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                  <a href={routes.books.index.href()} class="btn btn-secondary">
                    Continue Shopping
                  </a>
                  {user ? (
                    <a href={routes.checkout.index.href()} class="btn">
                      Proceed to Checkout
                    </a>
                  ) : (
                    <a href={routes.auth.login.index.href()} class="btn">
                      Login to Checkout
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <p>Your cart is empty.</p>
                <p style="margin-top: 1rem;">
                  <a href={routes.books.index.href()} class="btn">
                    Browse Books
                  </a>
                </p>
              </>
            )}
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

        let bookId = formData.get('bookId')?.toString() ?? ''

        let book = getBookById(bookId)
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
        let bookId = formData.get('bookId')?.toString() ?? ''
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

        let bookId = formData.get('bookId')?.toString() ?? ''

        session.set('cart', removeFromCart(getCurrentCart(), bookId))

        if (formData.get('redirect') === 'none') {
          return new Response(null, { status: 204 })
        }

        return redirect(routes.cart.index.href())
      },
    },
  },
} satisfies Controller<typeof routes.cart>
