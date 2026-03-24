import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { render } from '../../../utils/render.tsx'
import { AccountSettingsPage } from './page.tsx'

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

      return render(<AccountSettingsPage user={user} />)
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
