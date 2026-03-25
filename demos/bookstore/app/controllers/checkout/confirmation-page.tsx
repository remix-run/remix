import { css } from 'remix/component'

import type { Order } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function CheckoutOrderNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Order Not Found</h1>
        <p>
          <a href={routes.account.orders.index.href()} class="btn">
            View My Orders
          </a>
        </p>
      </div>
    </Layout>
  )
}

export function CheckoutConfirmationPage() {
  return ({ order }: { order: Order }) => (
    <Layout>
      <div class="alert alert-success">
        <h1 mix={css({ marginBottom: '0.5rem' })}>Order Confirmed!</h1>
        <p>Thank you for your purchase. Your order has been placed successfully.</p>
      </div>

      <div class="card">
        <h2>Order #{order.id}</h2>
        <p>
          <strong>Order Date:</strong> {new Date(order.created_at).toLocaleDateString()}
        </p>
        <p>
          <strong>Total:</strong> ${order.total.toFixed(2)}
        </p>
        <p>
          <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
        </p>

        <p mix={css({ marginTop: '2rem' })}>
          We'll send you a confirmation email shortly. You can track your order status in your
          account.
        </p>

        <div mix={css({ marginTop: '2rem' })}>
          <a href={routes.account.orders.show.href({ orderId: order.id })} class="btn">
            View Order Details
          </a>
          <a
            href={routes.books.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '0.5rem' })}
          >
            Continue Shopping
          </a>
        </div>
      </div>
    </Layout>
  )
}
