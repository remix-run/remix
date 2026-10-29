import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { accounts } from '../../data/account.ts'
import { routes } from '../../routes.ts'
import { FieldsPage } from './page.tsx'
import { AccountForm } from './public/fields.ts'

export default createController(routes.fields, {
  actions: {
    async index({ db, render }) {
      let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
      return render(<FieldsPage storedAccounts={storedAccounts} />, {
        document: { title: 'Independent fields | Form examples' },
      })
    },
    async action({ db, formData, render }) {
      let submission = AccountForm.parseSafe(formData)

      if (!submission.success) {
        let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
        return render(<FieldsPage storedAccounts={storedAccounts} submission={submission} />, {
          document: { title: 'Independent fields | Form examples' },
          responseInit: { status: 400 },
        })
      }

      await db.create(accounts, {
        id: crypto.randomUUID(),
        displayName: submission.value.displayName,
        email: submission.value.email,
      })
      return redirect(routes.fields.index.href(), 303)
    },
  },
})
