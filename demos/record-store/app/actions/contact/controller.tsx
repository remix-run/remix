import * as fd from 'remix/data-schema/experimental/form'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { browsingResponseInit } from '../browsing-response.ts'
import { ContactPage, ContactSuccessPage } from './page.tsx'
import { ContactForm } from './public/schema.ts'

export default createController(routes.contact, {
  actions: {
    index({ render, request }) {
      return render(<ContactPage />, browsingResponseInit(request))
    },

    async action({ formData, render }) {
      let submission = fd.parseSafe(ContactForm, formData)
      if (!submission.success) {
        return render(<ContactPage submission={submission} />, { status: 400 })
      }
      return render(<ContactSuccessPage />)
    },
  },
})
