import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import type { FormSubmission } from 'remix/data-schema/form'

import type { Cart } from '../../utils/cart.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { ShippingFields } from './public/shipping-form.tsx'

export interface CheckoutPageProps {
  cart: Cart
  total: number
  submission?: FormSubmission
}

export function EmptyCheckoutPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Checkout</h1>
        <p>Your cart is empty. Add some books before checking out.</p>
        <p mix={css({ marginTop: '1rem' })}>
          <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn">
            Browse Books
          </a>
        </p>
      </div>
    </Layout>
  )
}

export function CheckoutPage(handle: Handle<CheckoutPageProps>) {
  return () => {
    let { cart, total } = handle.props

    return (
      <Layout>
        <h1>Checkout</h1>

        <div class="card">
          <h2>Order Summary</h2>
          <table mix={css({ marginTop: '1rem' })}>
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
                <td colSpan={3} mix={css({ textAlign: 'right', fontWeight: 'bold' })}>
                  Total:
                </td>
                <td mix={css({ fontWeight: 'bold' })}>${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="card" mix={css({ marginTop: '1.5rem' })}>
          <h2>Shipping Information</h2>
          <ShippingFields submission={handle.props.submission} />
        </div>
      </Layout>
    )
  }
}
