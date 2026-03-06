import { html } from 'remix/component/tag'
import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'

import { routes } from './routes.ts'
import { Layout } from './layout.ts'
import { requireAuth } from './middleware/auth.ts'
import { requireAdmin } from './middleware/admin.ts'
import { render } from './utils/render.ts'

import adminBooksController from './admin.books.ts'
import adminOrdersController from './admin.orders.ts'
import adminUsersController from './admin.users.ts'

export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index() {
      return render(
        html`<${Layout}>
          <h1>Admin Dashboard</h1>

          <div
            mix=${[
              css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
              }),
            ]}
          >
            <div class="card">
              <h2>Manage Books</h2>
              <p>Add, edit, or remove books from the catalog.</p>
              <a
                href=${routes.admin.books.index.href()}
                class="btn"
                mix=${[css({ marginTop: '1rem' })]}
              >
                View Books
              </a>
            </div>

            <div class="card">
              <h2>Manage Users</h2>
              <p>View and manage user accounts.</p>
              <a
                href=${routes.admin.users.index.href()}
                class="btn"
                mix=${[css({ marginTop: '1rem' })]}
              >
                View Users
              </a>
            </div>

            <div class="card">
              <h2>View Orders</h2>
              <p>Monitor and manage customer orders.</p>
              <a
                href=${routes.admin.orders.index.href()}
                class="btn"
                mix=${[css({ marginTop: '1rem' })]}
              >
                View Orders
              </a>
            </div>
          </div>
        <//>`,
      )
    },

    books: adminBooksController,
    users: adminUsersController,
    orders: adminOrdersController,
  },
} satisfies Controller<typeof routes.admin>
