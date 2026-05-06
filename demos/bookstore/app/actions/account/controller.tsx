import type { AppController } from '../../router.ts'

import { requireAuth } from '../../middleware/auth.ts'
import type { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { render } from '../render.tsx'
import { AccountPage } from './page.tsx'

export default {
  middleware: [requireAuth()],
  actions: {
    index() {
      let user = getCurrentUser()

      return render(<AccountPage user={user} />)
    },
  },
} satisfies AppController<typeof routes.account>
