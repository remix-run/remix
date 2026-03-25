import { css } from 'remix/component'

import type { User } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'

export function AccountSettingsPage() {
  return ({ user }: { user: User }) => (
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
            <input type="password" id="password" name="password" autoComplete="new-password" />
          </div>

          <button type="submit" class="btn">
            Update Settings
          </button>
          <a
            href={routes.account.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '0.5rem' })}
          >
            Cancel
          </a>
        </RestfulForm>
      </div>
    </Layout>
  )
}
