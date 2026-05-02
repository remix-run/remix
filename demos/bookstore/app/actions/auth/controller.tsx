import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { Session } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'

export default {
  actions: {
    logout({ get }) {
      let session = get(Session)
      session.unset('auth')
      session.regenerateId(true)
      return redirect(routes.home.href())
    },
  },
} satisfies Controller<typeof routes.auth>
