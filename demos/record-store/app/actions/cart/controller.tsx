import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { CartPage } from './page.tsx'

export default createController(routes.cart, {
  actions: {
    index({ render }) {
      return render(<CartPage />)
    },
  },
})
