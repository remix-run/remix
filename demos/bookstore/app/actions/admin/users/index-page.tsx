import { css } from 'remix/ui'

import type { User } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export interface AdminUsersIndexPageProps {
  users: User[]
  currentUserId: number
}

export function AdminUsersIndexPage() {
  return ({ currentUserId, users }: AdminUsersIndexPageProps) => (
    <Layout>
      <h1>Manage Users</h1>

      <p mix={css({ marginBottom: '1rem' })}>
        <a href={routes.admin.index.href()} class="btn btn-secondary">
          Back to Dashboard
        </a>
      </p>

      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span class={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                    {user.role}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td class="actions">
                  <a
                    href={routes.admin.users.edit.href({ userId: user.id })}
                    class="btn btn-secondary"
                    mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
                  >
                    Edit
                  </a>
                  {user.id !== currentUserId ? (
                    <RestfulForm
                      method="DELETE"
                      action={routes.admin.users.destroy.href({ userId: user.id })}
                      mix={css({ display: 'inline' })}
                    >
                      <button
                        type="submit"
                        class="btn btn-danger"
                        mix={css({ fontSize: '0.875rem', padding: '0.25rem 0.5rem' })}
                      >
                        Delete
                      </button>
                    </RestfulForm>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
