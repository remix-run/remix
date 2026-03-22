import type { Controller } from 'remix/fetch-router'

import { requireAuth } from '../../middleware/auth.ts'
import type { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { render } from '../render.tsx'
import ordersController from './orders/controller.tsx'
import { AccountPage } from './page.tsx'
import settingsController from './settings/controller.tsx'

export default {
  middleware: [requireAuth()],
  actions: {
    index() {
      let user = getCurrentUser()

      return render(<AccountPage user={user} />)
    },

    settings: settingsController,
    orders: ordersController,
  },
} satisfies Controller<typeof routes.account>
