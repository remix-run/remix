import { createController } from 'remix/router'

import { requireAdmin } from '../../middleware/admin.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { AdminDashboardPage } from './page.tsx'

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index({ render }) {
      return render(<AdminDashboardPage />)
    },
  },
})
