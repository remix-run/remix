import { createController } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { CartPage } from './page.tsx'

export default createController(routes.cart, {
  actions: {
    index() {
      return render(<CartPage />)
    },
  },
})
