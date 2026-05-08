import { createController } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { ContactPage, ContactSuccessPage } from './page.tsx'

export default createController(routes.contact, {
  actions: {
    index() {
      return render(<ContactPage />)
    },

    async action() {
      return render(<ContactSuccessPage />)
    },
  },
})
