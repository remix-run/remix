import { css } from 'remix/component'

import type { Order } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AccountOrdersIndexPage() {
  return ({ orders }: { orders: Order[] }) => (
    <Layout>
      <h1>My Orders</h1>

      <div class="card">
        {orders.length > 0 ? (
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
                      href={routes.account.orders.show.href({ orderId: order.id })}
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
        ) : (
          <p>You have no orders yet.</p>
        )}
      </div>

      <p mix={css({ marginTop: '1.5rem' })}>
        <a href={routes.account.index.href()} class="btn btn-secondary">
          Back to Account
        </a>
      </p>
    </Layout>
  )
}
