import { css } from 'remix/component'

import type { User } from '../../../data/schema.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export interface AdminUserFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  user: User
}

export function AdminUserFormPage() {
  return ({ action, cancelHref, submitLabel, title, user }: AdminUserFormPageProps) => (
    <Layout>
      <h1>{title}</h1>

      <div class="card">
        <RestfulForm method="PUT" action={action}>
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" value={user.name} required />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" value={user.email} required />
          </div>

          <div class="form-group">
            <label for="role">Role</label>
            <select id="role" name="role">
              <option value="customer" selected={user.role === 'customer'}>
                Customer
              </option>
              <option value="admin" selected={user.role === 'admin'}>
                Admin
              </option>
            </select>
          </div>

          <button type="submit" class="btn">
            {submitLabel}
          </button>
          <a href={cancelHref} class="btn btn-secondary" mix={css({ marginLeft: '0.5rem' })}>
            Cancel
          </a>
        </RestfulForm>
      </div>
    </Layout>
  )
}
