import { createController } from 'remix/fetch-router'
import { Renderer } from 'remix/render-middleware'

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
