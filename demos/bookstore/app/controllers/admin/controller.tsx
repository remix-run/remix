import type { Controller } from 'remix/fetch-router'

import { requireAdmin } from '../../middleware/admin.ts'
import { requireAuth } from '../../middleware/auth.ts'
import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import booksController from './books/controller.tsx'
import ordersController from './orders/controller.tsx'
import { AdminDashboardPage } from './page.tsx'
import usersController from './users/controller.tsx'

export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index() {
      return render(<AdminDashboardPage />)
    },

    books: booksController,
    users: usersController,
    orders: ordersController,
  },
} satisfies Controller<typeof routes.admin>
