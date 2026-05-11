import { createController } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { authCookie } from '../../middleware/auth.ts'

export default createController(routes.auth, {
  actions: {
    async logout() {
      return redirect(routes.auth.login.index.href(), {
        headers: {
          'Set-Cookie': await authCookie.serialize('', { maxAge: 0 }),
        },
      })
    },
  },
})
