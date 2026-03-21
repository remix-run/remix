import { css } from 'remix/component'

import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../ui/layout.tsx'

export interface CheckoutPageProps {
  cart: Cart
  total: number
}

export function EmptyCheckoutPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Checkout</h1>
        <p>Your cart is empty. Add some books before checking out.</p>
        <p mix={[css({ marginTop: '1rem' })]}>
          <a href={routes.books.index.href()} class="btn">
            Browse Books
          </a>
        </p>
      </div>
    </Layout>
  )
}

export function CheckoutPage() {
  return ({ cart, total }: CheckoutPageProps) => (
    <Layout>
      <h1>Checkout</h1>

      <div class="card">
        <h2>Order Summary</h2>
        <table mix={[css({ marginTop: '1rem' })]}>
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
              <td colSpan={3} mix={[css({ textAlign: 'right', fontWeight: 'bold' })]}>
                Total:
              </td>
              <td mix={[css({ fontWeight: 'bold' })]}>${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="card" mix={[css({ marginTop: '1.5rem' })]}>
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
            mix={[css({ marginLeft: '0.5rem' })]}
          >
            Back to Cart
          </a>
        </form>
      </div>
    </Layout>
  )
}
