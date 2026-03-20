import { redirect } from 'remix/response/redirect'

import { Session } from '../../middleware/session.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { clearAuthenticatedSession } from '../../utils/auth-session.ts'

export function logout(context: AppContext) {
  let session = context.get(Session)
  clearAuthenticatedSession(session)
  session.regenerateId(true)
  return redirect(routes.home.href())
}
