import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { browsingResponseInit } from '../browsing-response.ts'
import { ContactPage, ContactSuccessPage } from './page.tsx'

export default createController(routes.contact, {
  actions: {
    index({ render, request }) {
      return render(<ContactPage />, browsingResponseInit(request))
    },

    async action({ render }) {
      return render(<ContactSuccessPage />)
    },
  },
})
