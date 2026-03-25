import { css } from 'remix/component'

import type { Order } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AdminOrdersIndexPage() {
  return ({ orders }: { orders: Order[] }) => (
    <Layout>
      <h1>Manage Orders</h1>

      <p mix={css({ marginBottom: '1rem' })}>
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
                    mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
