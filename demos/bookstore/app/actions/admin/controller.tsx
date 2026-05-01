import type { Controller } from 'remix/fetch-router'

import { requireAdmin } from '../../middleware/admin.ts'
import { requireAuth } from '../../middleware/auth.ts'
import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { AdminDashboardPage } from './page.tsx'

export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index() {
      return render(<AdminDashboardPage />)
    },
  },
} satisfies Controller<typeof routes.admin>
