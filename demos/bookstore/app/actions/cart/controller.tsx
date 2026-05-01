import type { Controller } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { CartPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<CartPage />)
    },
  },
} satisfies Controller<typeof routes.cart>
