import type { Controller } from 'remix/fetch-router'

import { requireAuth } from '../../middleware/auth.ts'
import type { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { render } from '../../utils/render.tsx'
import { AccountPage } from './page.tsx'

export default {
  middleware: [requireAuth()],
  actions: {
    index() {
      let user = getCurrentUser()

      return render(<AccountPage user={user} />)
    },
  },
} satisfies Controller<typeof routes.account>
