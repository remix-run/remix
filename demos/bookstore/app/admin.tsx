import type { Controller } from 'remix'

import { routes } from './routes.ts'
import { Layout } from './layout.tsx'
import { requireAuth } from './middleware/auth.ts'
import { requireAdmin } from './middleware/admin.ts'
import { render } from './utils/render.ts'

import adminBooksController from './admin.books.tsx'
import adminOrdersController from './admin.orders.tsx'
import adminUsersController from './admin.users.tsx'

export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index() {
      return render(
        <Layout>
          <h1>Admin Dashboard</h1>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="card">
              <h2>Manage Books</h2>
              <p>Add, edit, or remove books from the catalog.</p>
              <a href={routes.admin.books.index.href()} class="btn" style="margin-top: 1rem;">
                View Books
              </a>
            </div>

            <div class="card">
              <h2>Manage Users</h2>
              <p>View and manage user accounts.</p>
              <a href={routes.admin.users.index.href()} class="btn" style="margin-top: 1rem;">
                View Users
              </a>
            </div>

            <div class="card">
              <h2>View Orders</h2>
              <p>Monitor and manage customer orders.</p>
              <a href={routes.admin.orders.index.href()} class="btn" style="margin-top: 1rem;">
                View Orders
              </a>
            </div>
          </div>
        </Layout>,
      )
    },

    books: adminBooksController,
    users: adminUsersController,
    orders: adminOrdersController,
  },
} satisfies Controller<typeof routes.admin>
