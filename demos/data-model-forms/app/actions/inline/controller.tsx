import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { accounts } from '../../data/account.ts'
import { routes } from '../../routes.ts'
import { InlinePage } from './page.tsx'
import { AccountForm } from './public/account-form.ts'

export default createController(routes.inline, {
  actions: {
    async index({ db, render }) {
      let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
      return render(<InlinePage storedAccounts={storedAccounts} />, {
        document: { title: 'All inline schemas | Form examples' },
      })
    },
    async action({ db, formData, render }) {
      let submission = AccountForm.parse(formData)

      if (!submission.success) {
        let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
        return render(<InlinePage storedAccounts={storedAccounts} submission={submission} />, {
          document: { title: 'All inline schemas | Form examples' },
          responseInit: { status: 400 },
        })
      }

      let { displayName, email } = submission.value
      await db.create(accounts, { id: crypto.randomUUID(), displayName, email })
      return redirect(routes.inline.index.href(), 303)
    },
  },
})
