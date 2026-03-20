import { redirect } from 'remix/response/redirect'

import { Session } from '../../middleware/session.ts'
import type { RouteContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { clearAuthenticatedSession } from '../../utils/auth-session.ts'

export function logout(context: RouteContext) {
  let session = context.get(Session)
  clearAuthenticatedSession(session)
  session.regenerateId(true)
  return redirect(routes.home.href())
}
