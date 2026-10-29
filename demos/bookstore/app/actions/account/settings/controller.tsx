import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { users } from '../../../data/schema.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { AccountSettingsPage } from './page.tsx'
import { AccountSettingsForm } from './public/schema.ts'

export default createController(routes.account.settings, {
  middleware: [requireAuth()],
  actions: {
    index({ auth, render }) {
      let user = getCurrentUser(auth)

      return render(<AccountSettingsPage user={user} />)
    },

    async update({ auth, db, formData, render }) {
      let user = getCurrentUser(auth)
      let submission = AccountSettingsForm.parseSafe(formData)
      if (!submission.success) {
        return render(<AccountSettingsPage user={user} submission={submission} />, { status: 400 })
      }
      let { email, name, password } = submission.value

      let updateData = password
        ? { name, email, password_hash: await hashPassword(password) }
        : { name, email }
      await db.update(users, user.id, updateData)

      return redirect(routes.account.index.href())
    },
  },
})
