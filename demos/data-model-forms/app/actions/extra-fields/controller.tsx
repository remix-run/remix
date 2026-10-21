import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { accounts } from '../../data/account.ts'
import { routes } from '../../routes.ts'
import { RegistrationPage } from './page.tsx'
import { RegistrationForm } from './public/registration-form.ts'

export default createController(routes['extra-fields'], {
  actions: {
    async index({ db, render }) {
      let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })

      return render(<RegistrationPage storedAccounts={storedAccounts} />, {
        document: { title: 'Schema + extra fields | Form examples' },
      })
    },
    async action({ db, formData, render }) {
      let submission = RegistrationForm.parse(formData)

      if (!submission.success) {
        let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })

        return render(
          <RegistrationPage storedAccounts={storedAccounts} submission={submission} />,
          {
            document: { title: 'Schema + extra fields | Form examples' },
            responseInit: { status: 400 },
          },
        )
      }

      let { displayName, email, age, website } = submission.value

      await db.create(accounts, {
        id: crypto.randomUUID(),
        displayName,
        email,
        ...(age === undefined ? {} : { age }),
        ...(website === undefined ? {} : { website }),
      })

      return redirect(routes['extra-fields'].index.href(), 303)
    },
  },
})
