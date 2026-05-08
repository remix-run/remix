import { createController } from 'remix/fetch-router'
import { Renderer } from 'remix/render-middleware'

import { routes } from '../../routes.ts'
import { ContactPage, ContactSuccessPage } from './page.tsx'

export default createController(routes.contact, {
  actions: {
    index({ get }) {
      let render = get(Renderer)
      return render(<ContactPage />)
    },

    async action({ get }) {
      let render = get(Renderer)
      return render(<ContactSuccessPage />)
    },
  },
})
