import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database, query } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'
import { render } from '../../render.tsx'
import { AdminUserFormPage } from './form.tsx'
import { AdminUsersIndexPage } from './index-page.tsx'
import { AdminUserNotFoundPage, AdminUserShowPage } from './show-page.tsx'

let textField = f.field(s.defaulted(s.string(), ''))
let roleField = f.field(
  s.defaulted(s.union([s.literal('customer'), s.literal('admin')]), 'customer'),
)
let userSchema = f.object({
  name: textField,
  email: textField,
  role: roleField,
})

export default {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let currentUser = getCurrentUser()
      let allUsers = await db.exec(query(users).orderBy('id', 'asc').all())

      return render(<AdminUsersIndexPage users={allUsers} currentUserId={currentUser.id} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.exec(query(users).find(userId))

      if (!targetUser) {
        return render(<AdminUserNotFoundPage />, { status: 404 })
      }

      return render(<AdminUserShowPage user={targetUser} />)
    },

    async edit({ get, params }) {
      let db = get(Database)
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.exec(query(users).find(userId))

      if (!targetUser) {
        return render(<AdminUserNotFoundPage />, { status: 404 })
      }

      return render(
        <AdminUserFormPage
          title="Edit User"
          action={routes.admin.users.update.href({ userId: targetUser.id })}
          cancelHref={routes.admin.users.index.href()}
          submitLabel="Update User"
          user={targetUser}
        />,
      )
    },

    async update({ get, params }) {
      let db = get(Database)
      let formData = get(FormData)
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.exec(query(users).find(userId))
      let { email, name, role } = s.parse(userSchema, formData)

      if (targetUser) {
        await db.exec(
          query(users).where({ id: targetUser.id }).update({
            name,
            email,
            role,
          }),
        )
      }

      return redirect(routes.admin.users.index.href())
    },

    async destroy({ get, params }) {
      let db = get(Database)
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.exec(query(users).find(userId))
      if (targetUser) {
        await db.exec(query(users).where({ id: targetUser.id }).delete())
      }

      return redirect(routes.admin.users.index.href())
    },
  },
} satisfies Controller<typeof routes.admin.users>
