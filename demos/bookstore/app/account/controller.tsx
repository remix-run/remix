import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { Layout } from '../layout.tsx'
import { requireAuth } from '../middleware/auth.ts'
import { getCurrentUser } from '../utils/context.ts'
import { render } from '../utils/render.ts'
import ordersController from './orders/controller.tsx'
import settingsController from './settings/controller.tsx'

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

            <p mix={[css({ marginTop: '1.5rem' })]}>
              <a href={routes.account.settings.index.href()} class="btn">
                Edit Settings
              </a>
            </p>
          </div>

          <div class="card" mix={[css({ marginTop: '1.5rem' })]}>
            <h2>Quick Links</h2>
            <p>
              <a href={routes.account.orders.index.href()} class="btn btn-secondary">
                View Orders
              </a>
              <a
                href={routes.books.index.href()}
                class="btn btn-secondary"
                mix={[css({ marginLeft: '0.5rem' })]}
              >
                Browse Books
              </a>
            </p>
          </div>
        </Layout>,
      )
    },

    settings: settingsController,
    orders: ordersController,
  },
} satisfies Controller<typeof routes.account>
