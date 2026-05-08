import { createController } from 'remix/fetch-router'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { render } from '../render.tsx'
import { AccountPage } from './page.tsx'

export default createController(routes.account, {
  middleware: [requireAuth()] as const,
  actions: {
    index() {
      let user = getCurrentUser()

      return render(<AccountPage user={user} />)
    },
  },
})
