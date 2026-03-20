import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import { Database } from 'remix/data-table'

import { routes } from '../../routes.ts'
import { Layout } from '../../layout.tsx'
import { orders, orderItemsWithBook } from '../../data/schema.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'
import { render } from '../../utils/render.ts'

let ordersController = {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let user = getCurrentUser()
      let userOrders = await db.findMany(orders, {
        where: { user_id: user.id },
        orderBy: ['created_at', 'asc'],
        with: { items: orderItemsWithBook },
      })

      return render(
        <Layout>
          <h1>My Orders</h1>

          <div class="card">
            {userOrders.length > 0 ? (
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
                  {userOrders.map((order) => (
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
                          href={routes.account.orders.show.href({ orderId: order.id })}
                          class="btn btn-secondary"
                          mix={[css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })]}
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>You have no orders yet.</p>
            )}
          </div>

          <p mix={[css({ marginTop: '1.5rem' })]}>
            <a href={routes.account.index.href()} class="btn btn-secondary">
              Back to Account
            </a>
          </p>
        </Layout>,
      )
    },

    async show({ get, params }) {
      let db = get(Database)
      let user = getCurrentUser()
      let orderId = parseId(params.orderId)
      let order =
        orderId === undefined
          ? undefined
          : await db.find(orders, orderId, {
              with: { items: orderItemsWithBook },
            })

      if (!order || order.user_id !== user.id) {
        return render(
          <Layout>
            <div class="card">
              <h1>Order Not Found</h1>
              <p>
                <a href={routes.account.orders.index.href()} class="btn">
                  Back to Orders
                </a>
              </p>
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
              <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
            </p>

            <h2 mix={[css({ marginTop: '2rem' })]}>Items</h2>
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
                  <td colSpan={3} mix={[css({ textAlign: 'right', fontWeight: 'bold' })]}>
                    Total:
                  </td>
                  <td mix={[css({ fontWeight: 'bold' })]}>${order.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <h2 mix={[css({ marginTop: '2rem' })]}>Shipping Address</h2>
            <p>{shippingAddress.street}</p>
            <p>
              {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
            </p>
          </div>

          <p mix={[css({ marginTop: '1.5rem' })]}>
            <a href={routes.account.orders.index.href()} class="btn btn-secondary">
              Back to Orders
            </a>
          </p>
        </Layout>,
      )
    },
  },
} satisfies Controller<typeof routes.account.orders>

export default ordersController
