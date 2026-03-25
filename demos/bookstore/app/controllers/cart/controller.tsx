import type { Controller } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import cartApiController from './api/controller.tsx'
import { CartPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<CartPage />)
    },

    api: cartApiController,
  },
} satisfies Controller<typeof routes.cart>
