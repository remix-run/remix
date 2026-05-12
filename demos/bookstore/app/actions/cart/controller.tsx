import { createController } from 'remix/router'
import { Renderer } from 'remix/middleware/render'

import { routes } from '../../routes.ts'
import { CartPage } from './page.tsx'

export default createController(routes.cart, {
  actions: {
    index({ get }) {
      let render = get(Renderer)
      return render(<CartPage />)
    },
  },
})
