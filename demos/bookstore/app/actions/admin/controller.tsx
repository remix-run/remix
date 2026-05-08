import { createController } from 'remix/fetch-router'

import { requireAdmin } from '../../middleware/admin.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { render } from '../render.tsx'
import { AdminDashboardPage } from './page.tsx'

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()] as const,
  actions: {
    index() {
      return render(<AdminDashboardPage />)
    },
  },
})
