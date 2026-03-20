import { redirect } from 'remix/response/redirect'

import { clearAuthenticatedSession } from '../../utils/auth-session.ts'
import { Session } from '../../middleware/session.ts'
import { defineRoute } from '../../router.ts'
import { routes } from '../../routes.ts'

export let logout = defineRoute(context => {
  let session = context.get(Session)
  clearAuthenticatedSession(session)
  session.regenerateId(true)
  return redirect(routes.home.href())
})
