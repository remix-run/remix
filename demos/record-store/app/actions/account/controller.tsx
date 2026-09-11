import { createController } from 'remix/router'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { AccountPage } from './page.tsx'

export default createController(routes.account, {
  middleware: [requireAuth()],
  actions: {
    index({ auth, render }) {
      let user = getCurrentUser(auth)

      return render(<AccountPage user={user} />)
    },
  },
})
