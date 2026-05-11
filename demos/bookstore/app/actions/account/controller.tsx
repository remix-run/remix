import { createController } from 'remix/fetch-router'
import { Renderer } from 'remix/render-middleware'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { AccountPage } from './page.tsx'

export default createController(routes.account, {
  middleware: [requireAuth()],
  actions: {
    index({ get }) {
      let render = get(Renderer)
      let user = getCurrentUser()

      return render(<AccountPage user={user} />)
    },
  },
})
