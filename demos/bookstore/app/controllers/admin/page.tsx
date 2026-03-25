import { css } from 'remix/component'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function AdminDashboardPage() {
  return () => (
    <Layout>
      <h1>Admin Dashboard</h1>

      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
        })}
      >
        <div class="card">
          <h2>Manage Books</h2>
          <p>Add, edit, or remove books from the catalog.</p>
          <a href={routes.admin.books.index.href()} class="btn" mix={css({ marginTop: '1rem' })}>
            View Books
          </a>
        </div>

        <div class="card">
          <h2>Manage Users</h2>
          <p>View and manage user accounts.</p>
          <a href={routes.admin.users.index.href()} class="btn" mix={css({ marginTop: '1rem' })}>
            View Users
          </a>
        </div>

        <div class="card">
          <h2>View Orders</h2>
          <p>Monitor and manage customer orders.</p>
          <a href={routes.admin.orders.index.href()} class="btn" mix={css({ marginTop: '1rem' })}>
            View Orders
          </a>
        </div>
      </div>
    </Layout>
  )
}
