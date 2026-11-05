import { createController } from 'remix/router'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { AccountPage } from './page.tsx'

export default createController(routes.account, {
  middleware: [requireAuth()],
  actions: {
    index({ auth, render }) {
      let user = auth.identity

      return render(<AccountPage user={user} />)
    },
  },
})
