import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { routes } from './routes.ts'
import { Layout } from './layout.tsx'
import { requireAuth } from './middleware/auth.ts'
import { orders, orderItemsWithBook, users } from './data/schema.ts'
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
              <strong>Member Since:</strong> {new Date(user.created_at).toLocaleDateString()}
            </p>

            <p css={{ marginTop: '1.5rem' }}>
              <a href={routes.account.settings.index.href()} class="btn">
                Edit Settings
              </a>
            </p>
          </div>

          <div class="card" css={{ marginTop: '1.5rem' }}>
            <h2>Quick Links</h2>
            <p>
              <a href={routes.account.orders.index.href()} class="btn btn-secondary">
                View Orders
              </a>
              <a
                href={routes.books.index.href()}
                class="btn btn-secondary"
                css={{ marginLeft: '0.5rem' }}
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
                  css={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </a>
              </RestfulForm>
            </div>
          </Layout>,
        )
      },

      async update({ db, formData }) {
        let user = getCurrentUser()

        let name = formData.get('name')?.toString() ?? ''
        let email = formData.get('email')?.toString() ?? ''
        let password = formData.get('password')?.toString() ?? ''

        let updateData: any = { name, email }
        if (password) {
          updateData.password = password
        }

        await db.update(users, user.id, updateData)

        return redirect(routes.account.index.href())
      },
    },

    orders: {
      async index({ db }) {
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
                            css={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
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

            <p css={{ marginTop: '1.5rem' }}>
              <a href={routes.account.index.href()} class="btn btn-secondary">
                Back to Account
              </a>
            </p>
          </Layout>,
        )
      },

      async show({ db, params }) {
        let user = getCurrentUser()
        let order = await db.find(orders, params.orderId, {
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
