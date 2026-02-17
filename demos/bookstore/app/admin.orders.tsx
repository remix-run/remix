import type { Controller } from 'remix/fetch-router'

import { routes } from './routes.ts'
import { orders, orderItemsWithBook } from './data/schema.ts'
import { Layout } from './layout.tsx'
import { render } from './utils/render.ts'

export default {
  async index({ db }) {
    let allOrders = await db.findMany(orders, {
      orderBy: ['created_at', 'asc'],
      with: { items: orderItemsWithBook },
    })

    return render(
      <Layout>
        <h1>Manage Orders</h1>

        <p css={{ marginBottom: '1rem' }}>
          <a href={routes.admin.index.href()} class="btn btn-secondary">
            Back to Dashboard
          </a>
        </p>

        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.map((order) => (
                <tr>
                  <td>#{order.id}</td>
                  <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>{order.items.length} item(s)</td>
                  <td>${order.total.toFixed(2)}</td>
                  <td>
                    <span class="badge badge-info">{order.status}</span>
                  </td>
                  <td>
                    <a
                      href={routes.admin.orders.show.href({ orderId: order.id })}
                      class="btn btn-secondary"
                      css={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Layout>,
    )
  },

  async show({ db, params }) {
    let order = await db.find(orders, params.orderId, {
      with: { items: orderItemsWithBook },
    })

    if (!order) {
      return render(
        <Layout>
          <div class="card">
            <h1>Order Not Found</h1>
          </div>
        </Layout>,
        { status: 404 },
      )
    }

    let shippingAddress = JSON.parse(order.shipping_address_json) as {
      street: string
      city: string
      state: string
      zip: string
    }

    return render(
      <Layout>
        <h1>Order #{order.id}</h1>

        <div class="card">
          <p>
            <strong>Order Date:</strong> {new Date(order.created_at).toLocaleDateString()}
          </p>
          <p>
            <strong>User ID:</strong> {order.user_id}
          </p>
          <p>
            <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
          </p>

          <h2 css={{ marginTop: '2rem' }}>Items</h2>
          <table css={{ marginTop: '1rem' }}>
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
                <td colSpan={3} css={{ textAlign: 'right', fontWeight: 'bold' }}>
                  Total:
                </td>
                <td css={{ fontWeight: 'bold' }}>${order.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <h2 css={{ marginTop: '2rem' }}>Shipping Address</h2>
          <p>{shippingAddress.street}</p>
          <p>
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
          </p>
        </div>

        <p css={{ marginTop: '1.5rem' }}>
          <a href={routes.admin.orders.index.href()} class="btn btn-secondary">
            Back to Orders
          </a>
        </p>
      </Layout>,
    )
  },
} satisfies Controller<typeof routes.admin.orders>
