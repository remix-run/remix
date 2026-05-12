import { createController } from 'remix/router'
import { Renderer } from 'remix/middleware/render'

import { requireAdmin } from '../../middleware/admin.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { AdminDashboardPage } from './page.tsx'

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index({ get }) {
      let render = get(Renderer)
      return render(<AdminDashboardPage />)
    },
  },
})
