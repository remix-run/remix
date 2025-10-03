import { html } from '@remix-run/fetch-router'
import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout } from './views/layout.ts'
import { USER_KEY } from './middleware/auth.ts'
import adminBooksHandlers from './admin.books.ts'
import adminUsersHandlers from './admin.users.ts'
import adminOrdersHandlers from './admin.orders.ts'

export default {
  index({ storage }) {
    let user = storage.get(USER_KEY)

    let content = `
    <h1>Admin Dashboard</h1>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
      <div class="card">
        <h2>Manage Books</h2>
        <p>Add, edit, or remove books from the catalog.</p>
        <a href="${routes.admin.books.index.href()}" class="btn" style="margin-top: 1rem;">View Books</a>
      </div>

      <div class="card">
        <h2>Manage Users</h2>
        <p>View and manage user accounts.</p>
        <a href="${routes.admin.users.index.href()}" class="btn" style="margin-top: 1rem;">View Users</a>
      </div>

      <div class="card">
        <h2>View Orders</h2>
        <p>Monitor and manage customer orders.</p>
        <a href="${routes.admin.orders.index.href()}" class="btn" style="margin-top: 1rem;">View Orders</a>
      </div>
    </div>
  `

    return html(layout(content, user))
  },

  books: adminBooksHandlers,
  users: adminUsersHandlers,
  orders: adminOrdersHandlers,
} satisfies RouteHandlers<typeof routes.admin>
