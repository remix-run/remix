import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'

export default createController(routes.auth, {
  actions: {
    logout({ session }) {
      session.unset('auth')
      session.regenerateId(true)
      return redirect(routes.home.href())
    },
  },
})
