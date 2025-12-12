import type { Controller } from 'remix'
import { createRedirectResponse as redirect } from 'remix'

import { routes } from './routes.ts'
import { Layout } from './layout.tsx'
import { requireAuth } from './middleware/auth.ts'
import { getOrdersByUserId, getOrderById } from './models/orders.ts'
import { updateUser } from './models/users.ts'
import { getCurrentUser } from './utils/context.ts'
import { render } from './utils/render.ts'
import { RestfulForm } from './components/restful-form.tsx'

export default {
  middleware: [requireAuth()],
  actions: {
    index() {
      let user = getCurrentUser()

      return render(
        <Layout>
          <h1>My Account</h1>

          <div class="card">
            <h2>Account Information</h2>
            <p>
              <strong>Name:</strong> {user.name}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <p>
              <strong>Member Since:</strong> {user.createdAt.toLocaleDateString()}
            </p>

            <p style="margin-top: 1.5rem;">
              <a href={routes.account.settings.index.href()} class="btn">
                Edit Settings
              </a>
            </p>
          </div>

          <div class="card" style="margin-top: 1.5rem;">
            <h2>Quick Links</h2>
            <p>
              <a href={routes.account.orders.index.href()} class="btn btn-secondary">
                View Orders
              </a>
              <a
                href={routes.books.index.href()}
                class="btn btn-secondary"
                style="margin-left: 0.5rem;"
              >
                Browse Books
              </a>
            </p>
          </div>
        </Layout>,
      )
    },

    settings: {
      index() {
        let user = getCurrentUser()

        return render(
          <Layout>
            <h1>Account Settings</h1>

            <div class="card">
              <RestfulForm method="PUT" action={routes.account.settings.update.href()}>
                <div class="form-group">
                  <label for="name">Name</label>
                  <input type="text" id="name" name="name" value={user.name} required />
                </div>

                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" value={user.email} required />
                </div>

                <div class="form-group">
                  <label for="password">New Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Update Settings
                </button>
                <a
                  href={routes.account.index.href()}
                  class="btn btn-secondary"
                  style="margin-left: 0.5rem;"
                >
                  Cancel
                </a>
              </RestfulForm>
            </div>
          </Layout>,
        )
      },

      async update({ formData }) {
        let user = getCurrentUser()

        let name = formData.get('name')?.toString() ?? ''
        let email = formData.get('email')?.toString() ?? ''
        let password = formData.get('password')?.toString() ?? ''

        let updateData: any = { name, email }
        if (password) {
          updateData.password = password
        }

        updateUser(user.id, updateData)

        return redirect(routes.account.index.href())
      },
    },

    orders: {
      index() {
        let user = getCurrentUser()
        let orders = getOrdersByUserId(user.id)

        return render(
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
                        <td>{order.createdAt.toLocaleDateString()}</td>
                        <td>{order.items.length} item(s)</td>
                        <td>${order.total.toFixed(2)}</td>
                        <td>
                          <span class="badge badge-info">{order.status}</span>
                        </td>
                        <td>
                          <a
                            href={routes.account.orders.show.href({ orderId: order.id })}
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
              ) : (
                <p>You have no orders yet.</p>
              )}
            </div>

            <p style="margin-top: 1.5rem;">
              <a href={routes.account.index.href()} class="btn btn-secondary">
                Back to Account
              </a>
            </p>
          </Layout>,
        )
      },

      show({ params }) {
        let user = getCurrentUser()
        let order = getOrderById(params.orderId)

        if (!order || order.userId !== user.id) {
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

        return render(
          <Layout>
            <h1>Order #{order.id}</h1>

            <div class="card">
              <p>
                <strong>Order Date:</strong> {order.createdAt.toLocaleDateString()}
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
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.zip}
              </p>
            </div>

            <p style="margin-top: 1.5rem;">
              <a href={routes.account.orders.index.href()} class="btn btn-secondary">
                Back to Orders
              </a>
            </p>
          </Layout>,
        )
      },
    },
  },
} satisfies Controller<typeof routes.account>
