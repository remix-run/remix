import { createController } from 'remix/router'

import { AssetEntry } from '../../middleware/asset-entry.ts'
import { routes } from '../../routes.ts'
import { RegistrationPage, RegistrationSuccessPage } from './page.tsx'
import { RegistrationForm } from './registration-form.ts'

export default createController(routes.registration, {
  actions: {
    index({ get, render }) {
      return render(<RegistrationPage assetEntry={get(AssetEntry)} />)
    },
    action({ formData, get, render }) {
      let submission = RegistrationForm.parse(formData)

      if (!submission.success) {
        return render(<RegistrationPage assetEntry={get(AssetEntry)} submission={submission} />, {
          status: 400,
        })
      }

      let { displayName, email, age, website, terms } = submission.value

      return render(
        <RegistrationSuccessPage
          assetEntry={get(AssetEntry)}
          registration={{ displayName, email, age, website, terms }}
        />,
      )
    },
  },
})
