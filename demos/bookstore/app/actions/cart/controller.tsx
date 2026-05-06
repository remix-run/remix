import type { AppController } from '../../router.ts'

import type { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { CartPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<CartPage />)
    },
  },
} satisfies AppController<typeof routes.cart>
