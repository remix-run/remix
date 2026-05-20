import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { ContactPage, ContactSuccessPage } from './page.tsx'

export default createController(routes.contact, {
  actions: {
    index({ render }) {
      return render(<ContactPage />)
    },

    async action({ render }) {
      return render(<ContactSuccessPage />)
    },
  },
})
