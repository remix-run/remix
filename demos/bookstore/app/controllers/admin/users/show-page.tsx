import { css } from 'remix/component'

import type { User } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function AdminUserNotFoundPage() {
  return () => (
    <Layout>
      <div class="card">
        <h1>User Not Found</h1>
      </div>
    </Layout>
  )
}

export function AdminUserShowPage() {
  return ({ user }: { user: User }) => (
    <Layout>
      <h1>User Details</h1>

      <div class="card">
        <p>
          <strong>Name:</strong> {user.name}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Role:</strong>{' '}
          <span class={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
            {user.role}
          </span>
        </p>
        <p>
          <strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}
        </p>

        <div mix={[css({ marginTop: '2rem' })]}>
          <a href={routes.admin.users.edit.href({ userId: user.id })} class="btn">
            Edit
          </a>
          <a
            href={routes.admin.users.index.href()}
            class="btn btn-secondary"
            mix={[css({ marginLeft: '0.5rem' })]}
          >
            Back to List
          </a>
        </div>
      </div>
    </Layout>
  )
}
