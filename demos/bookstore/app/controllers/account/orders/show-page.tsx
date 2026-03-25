import { css } from 'remix/component'

import type { Order } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export interface ShippingAddress {
  street: string
  city: string
  state: string
  zip: string
}

export function AccountOrderNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>Order Not Found</h1>
        <p>
          <a href={routes.account.orders.index.href()} class="btn">
            Back to Orders
          </a>
        </p>
      </div>
    </Layout>
  )
}

export function AccountOrderShowPage() {
  return ({ order, shippingAddress }: { order: Order; shippingAddress: ShippingAddress }) => (
    <Layout>
      <h1>Order #{order.id}</h1>

      <div class="card">
        <p>
          <strong>Order Date:</strong> {new Date(order.created_at).toLocaleDateString()}
        </p>
        <p>
          <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
        </p>

        <h2 mix={css({ marginTop: '2rem' })}>Items</h2>
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
            {order.items.map((item) => (
              <tr>
                <td>{item.title}</td>
                <td>{item.quantity}</td>
                <td>${item.unit_price.toFixed(2)}</td>
                <td>${(item.unit_price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} mix={css({ textAlign: 'right', fontWeight: 'bold' })}>
                Total:
              </td>
              <td mix={css({ fontWeight: 'bold' })}>${order.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <h2 mix={css({ marginTop: '2rem' })}>Shipping Address</h2>
        <p>{shippingAddress.street}</p>
        <p>
          {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
        </p>
      </div>

      <p mix={css({ marginTop: '1.5rem' })}>
        <a href={routes.account.orders.index.href()} class="btn btn-secondary">
          Back to Orders
        </a>
      </p>
    </Layout>
  )
}
