import type { BuildAction } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { clearAuthenticatedSession } from '../../utils/auth-session.ts'
import { routes } from '../../routes.ts'
import { Session } from '../../middleware/session.ts'

export let logoutAction = {
  action(context) {
    let session = context.get(Session)
    clearAuthenticatedSession(session)
    session.regenerateId(true)
    return redirect(routes.home.href())
  },
} satisfies BuildAction<'POST', typeof routes.auth.logout>
