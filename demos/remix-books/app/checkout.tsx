import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { requireAuth, SESSION_ID_KEY } from './middleware/auth.ts'
import { getCart, clearCart, getCartTotal } from './models/cart.ts'
import { createOrder, getOrderById } from './models/orders.ts'
import { Layout } from './layout.tsx'
import { render } from './utils/render.ts'
import { getCurrentUser, getStorage } from './utils/context.ts'

export default {
  use: [requireAuth],
  handlers: {
    index() {
      let sessionId = getStorage().get(SESSION_ID_KEY)
      let cart = getCart(sessionId)
      let total = getCartTotal(cart)

      if (cart.items.length === 0) {
        return render(
          <Layout>
            <div class="card">
              <h1>Checkout</h1>
              <p>Your cart is empty. Add some books before checking out.</p>
              <p style="margin-top: 1rem;">
                <a href={routes.books.index.href()} class="btn">
                  Browse Books
                </a>
              </p>
            </div>
          </Layout>,
        )
      }

      return render(
        <Layout>
          <h1>Checkout</h1>

          <div class="card">
            <h2>Order Summary</h2>
            <table style="margin-top: 1rem;">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((item) => (
                  <tr>
                    <td>{item.title}</td>
                    <td>{item.quantity}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style="text-align: right; font-weight: bold;">
                    Total:
                  </td>
                  <td style="font-weight: bold;">${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="card" style="margin-top: 1.5rem;">
            <h2>Shipping Information</h2>
            <form method="POST" action={routes.checkout.action.href()}>
              <div class="form-group">
                <label for="street">Street Address</label>
                <input type="text" id="street" name="street" required />
              </div>

              <div class="form-group">
                <label for="city">City</label>
                <input type="text" id="city" name="city" required />
              </div>

              <div class="form-group">
                <label for="state">State</label>
                <input type="text" id="state" name="state" required />
              </div>

              <div class="form-group">
                <label for="zip">ZIP Code</label>
                <input type="text" id="zip" name="zip" required />
              </div>

              <button type="submit" class="btn">
                Place Order
              </button>
              <a
                href={routes.cart.index.href()}
                class="btn btn-secondary"
                style="margin-left: 0.5rem;"
              >
                Back to Cart
              </a>
            </form>
          </div>
        </Layout>,
      )
    },

    async action({ request, url }) {
      let user = getCurrentUser()
      let sessionId = getStorage().get(SESSION_ID_KEY)
      let cart = getCart(sessionId)

      if (cart.items.length === 0) {
        let headers = new Headers()
        headers.set('Location', new URL(routes.cart.index.href(), url).href)
        return new Response(null, { status: 302, headers })
      }

      let formData = await request.formData()
      let shippingAddress = {
        street: formData.get('street')?.toString() || '',
        city: formData.get('city')?.toString() || '',
        state: formData.get('state')?.toString() || '',
        zip: formData.get('zip')?.toString() || '',
      }

      let order = createOrder(
        user.id,
        cart.items.map((item) => ({
          bookId: item.bookId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
        })),
        shippingAddress,
      )

      clearCart(sessionId)

      let headers = new Headers()
      headers.set(
        'Location',
        new URL(routes.checkout.confirmation.href({ orderId: order.id }), url).href,
      )
      return new Response(null, { status: 302, headers })
    },

    confirmation({ params }) {
      let user = getCurrentUser()
      let order = getOrderById(params.orderId)

      if (!order || order.userId !== user.id) {
        return render(
          <Layout>
            <div class="card">
              <h1>Order Not Found</h1>
              <p>
                <a href={routes.account.orders.index.href()} class="btn">
                  View My Orders
                </a>
              </p>
            </div>
          </Layout>,
          { status: 404 },
        )
      }

      return render(
        <Layout>
          <div class="alert alert-success">
            <h1 style="margin-bottom: 0.5rem;">Order Confirmed!</h1>
            <p>Thank you for your purchase. Your order has been placed successfully.</p>
          </div>

          <div class="card">
            <h2>Order #{order.id}</h2>
            <p>
              <strong>Order Date:</strong> {order.createdAt.toLocaleDateString()}
            </p>
            <p>
              <strong>Total:</strong> ${order.total.toFixed(2)}
            </p>
            <p>
              <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
            </p>

            <p style="margin-top: 2rem;">
              We'll send you a confirmation email shortly. You can track your order status in your
              account.
            </p>

            <div style="margin-top: 2rem;">
              <a href={routes.account.orders.show.href({ orderId: order.id })} class="btn">
                View Order Details
              </a>
              <a
                href={routes.books.index.href()}
                class="btn btn-secondary"
                style="margin-left: 0.5rem;"
              >
                Continue Shopping
              </a>
            </div>
          </div>
        </Layout>,
      )
    },
  },
} satisfies RouteHandlers<typeof routes.checkout>
