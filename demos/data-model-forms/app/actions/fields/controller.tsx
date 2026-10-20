import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import type { FormSubmission } from '@remix-run/ui/form'

import { accounts } from '../../data/account.ts'
import { routes } from '../../routes.ts'
import { FieldsPage } from './page.tsx'
import { DisplayName, Email } from './public/fields.ts'

export default createController(routes.fields, {
  actions: {
    async index({ db, render }) {
      let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
      return render(<FieldsPage storedAccounts={storedAccounts} />, {
        document: { title: 'Independent fields | Form examples' },
      })
    },
    async action({ db, formData, render }) {
      let displayName = DisplayName.parse(formData, 'displayName')
      let email = Email.parse(formData, 'email')

      if (!displayName.success || !email.success) {
        let submission: FormSubmission = {
          values: {
            ...(displayName.success ? { displayName: displayName.value } : displayName.values),
            ...(email.success ? { email: email.value } : email.values),
          },
          errors: {
            fields: {
              ...(!displayName.success ? displayName.errors.fields : {}),
              ...(!email.success ? email.errors.fields : {}),
            },
            form: [
              ...(!displayName.success ? displayName.errors.form : []),
              ...(!email.success ? email.errors.form : []),
            ],
          },
        }
        let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })
        return render(<FieldsPage storedAccounts={storedAccounts} submission={submission} />, {
          document: { title: 'Independent fields | Form examples' },
          responseInit: { status: 400 },
        })
      }

      await db.create(accounts, {
        id: crypto.randomUUID(),
        displayName: displayName.value,
        email: email.value,
      })
      return redirect(routes.fields.index.href(), 303)
    },
  },
})
