import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { accounts } from '../../data/account.ts'
import { AssetEntry } from '../../middleware/asset-entry.ts'
import { routes } from '../../routes.ts'
import { RegistrationPage } from './page.tsx'
import { RegistrationForm } from './registration-form.ts'

export default createController(routes.registration, {
  actions: {
    async index({ db, get, render }) {
      let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })

      return render(
        <RegistrationPage assetEntry={get(AssetEntry)} storedAccounts={storedAccounts} />,
      )
    },
    async action({ db, formData, get, render }) {
      let submission = RegistrationForm.parse(formData)

      if (!submission.success) {
        let storedAccounts = await db.findMany(accounts, { orderBy: ['displayName', 'asc'] })

        return render(
          <RegistrationPage
            assetEntry={get(AssetEntry)}
            storedAccounts={storedAccounts}
            submission={submission}
          />,
          { status: 400 },
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

      return redirect(routes.registration.index.href(), 303)
    },
  },
})
