import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { render } from '../../../utils/render.tsx'
import { AccountSettingsPage } from './page.tsx'

const textField = f.field(s.defaulted(s.string(), ''))
const passwordField = f.field(
  s.defaulted(s.union([s.literal(''), s.string().pipe(minLength(8))]), ''),
)
const accountSettingsSchema = f.object({
  name: textField,
  email: textField,
  password: passwordField,
})

export default {
  middleware: [requireAuth()],
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

      let updateData = password
        ? { name, email, password_hash: await hashPassword(password) }
        : { name, email }
      await db.update(users, user.id, updateData)

      return redirect(routes.account.index.href())
    },
  },
} satisfies Controller<typeof routes.account.settings>
