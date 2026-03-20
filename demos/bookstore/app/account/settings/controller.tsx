import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { Layout } from '../../layout.tsx'
import { users } from '../../data/schema.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { render } from '../../utils/render.ts'
import { RestfulForm } from '../../components/restful-form.tsx'

let textField = f.field(s.defaulted(s.string(), ''))
let accountSettingsSchema = f.object({
  name: textField,
  email: textField,
  password: textField,
})

let settingsController = {
  actions: {
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
                mix={[css({ marginLeft: '0.5rem' })]}
              >
                Cancel
              </a>
            </RestfulForm>
          </div>
        </Layout>,
      )
    },

    async update({ get }) {
      let db = get(Database)
      let formData = get(FormData)
      let user = getCurrentUser()
      let { email, name, password } = s.parse(accountSettingsSchema, formData)

      let updateData = password ? { name, email, password } : { name, email }
      await db.update(users, user.id, updateData)

      return redirect(routes.account.index.href())
    },
  },
} satisfies Controller<typeof routes.account.settings>

export default settingsController
