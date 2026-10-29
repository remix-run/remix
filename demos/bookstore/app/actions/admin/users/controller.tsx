import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'
import { AdminUserFormPage } from './form.tsx'
import { AdminUsersIndexPage } from './index-page.tsx'
import { AdminUserForm } from './public/schema.ts'
import { AdminUserNotFoundPage, AdminUserShowPage } from './show-page.tsx'

export default createController(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index({ auth, db, render }) {
      let currentUser = getCurrentUser(auth)
      let allUsers = await db.findMany(users, { orderBy: ['id', 'asc'] })

      return render(<AdminUsersIndexPage users={allUsers} currentUserId={currentUser.id} />)
    },

    async show({ db, params, render }) {
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.find(users, userId)

      if (!targetUser) {
        return render(<AdminUserNotFoundPage />, { status: 404 })
      }

      return render(<AdminUserShowPage user={targetUser} />)
    },

    async edit({ db, params, render }) {
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.find(users, userId)

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

    async update({ db, formData, params, render }) {
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.find(users, userId)
      let submission = AdminUserForm.parseSafe(formData)
      if (!submission.success && targetUser) {
        return render(
          <AdminUserFormPage
            title="Edit User"
            action={routes.admin.users.update.href({ userId: targetUser.id })}
            cancelHref={routes.admin.users.index.href()}
            submitLabel="Update User"
            user={targetUser}
            submission={submission}
          />,
          { status: 400 },
        )
      }

      if (targetUser && submission.success) {
        let { email, name, role } = submission.value
        await db.update(users, targetUser.id, {
          name,
          email,
          role,
        })
      }

      return redirect(routes.admin.users.index.href())
    },

    async destroy({ db, params }) {
      let userId = parseId(params.userId)
      let targetUser = userId === undefined ? undefined : await db.find(users, userId)
      if (targetUser) {
        await db.delete(users, targetUser.id)
      }

      return redirect(routes.admin.users.index.href())
    },
  },
})
