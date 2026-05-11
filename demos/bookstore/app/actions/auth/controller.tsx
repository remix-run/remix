import { createController } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { Session } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'

export default createController(routes.auth, {
  actions: {
    logout({ get }) {
      let session = get(Session)
      session.unset('auth')
      session.regenerateId(true)
      return redirect(routes.home.href())
    },
  },
})
