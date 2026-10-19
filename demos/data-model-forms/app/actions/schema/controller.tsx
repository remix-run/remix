import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { accounts } from '../../data/account.ts'
import { routes } from '../../routes.ts'
import { SchemaPage } from './page.tsx'
import { AccountForm } from './public/account-form.ts'

export default createController(routes.schema, {
  actions: {
    async index({ db, render }) {
      let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
      return render(<SchemaPage storedAccounts={storedAccounts} />, {
        document: { title: 'One object schema | Form examples' },
      })
    },
    async action({ db, formData, render }) {
      let submission = AccountForm.parse(formData)

      if (!submission.success) {
        let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
        return render(<SchemaPage storedAccounts={storedAccounts} submission={submission} />, {
          document: { title: 'One object schema | Form examples' },
          responseInit: { status: 400 },
        })
      }

      let { displayName, email, age, website } = submission.value
      await db.create(accounts, {
        id: crypto.randomUUID(),
        displayName,
        email,
        ...(age === undefined ? {} : { age }),
        ...(website === undefined ? {} : { website }),
      })
      return redirect(routes.schema.index.href(), 303)
    },
  },
})
