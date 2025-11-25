import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from './routes.ts'
import { getAllOrders, getOrderById } from './models/orders.ts'
import { Layout } from './layout.tsx'
import { render } from './utils/render.ts'

export default {
  index() {
    let orders = getAllOrders()

    return render(
      <Layout>
        <h1>Manage Orders</h1>

        <p style="margin-bottom: 1rem;">
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
              {orders.map((order) => (
                <tr>
                  <td>#{order.id}</td>
                  <td>{order.createdAt.toLocaleDateString()}</td>
                  <td>{order.items.length} item(s)</td>
                  <td>${order.total.toFixed(2)}</td>
                  <td>
                    <span class="badge badge-info">{order.status}</span>
                  </td>
                  <td>
                    <a
                      href={routes.admin.orders.show.href({ orderId: order.id })}
                      class="btn btn-secondary"
                      style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
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

  show({ params }) {
    let order = getOrderById(params.orderId)

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

    return render(
      <Layout>
        <h1>Order #{order.id}</h1>

        <div class="card">
          <p>
            <strong>Order Date:</strong> {order.createdAt.toLocaleDateString()}
          </p>
          <p>
            <strong>User ID:</strong> {order.userId}
          </p>
          <p>
            <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
          </p>

          <h2 style="margin-top: 2rem;">Items</h2>
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
              {order.items.map((item) => (
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
                <td style="font-weight: bold;">${order.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <h2 style="margin-top: 2rem;">Shipping Address</h2>
          <p>{order.shippingAddress.street}</p>
          <p>
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
          </p>
        </div>

        <p style="margin-top: 1.5rem;">
          <a href={routes.admin.orders.index.href()} class="btn btn-secondary">
            Back to Orders
          </a>
        </p>
      </Layout>,
    )
  },
} satisfies RouteHandlers<typeof routes.admin.orders>
