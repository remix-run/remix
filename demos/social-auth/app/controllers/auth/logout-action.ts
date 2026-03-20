import { redirect } from 'remix/response/redirect'

import type { SocialAuthRouteContext } from '../../router.ts'
import { clearAuthenticatedSession } from '../../utils/auth-session.ts'
import { routes } from '../../routes.ts'
import { Session } from '../../middleware/session.ts'

export function logout(context: SocialAuthRouteContext): Response {
  let session = context.get(Session)
  clearAuthenticatedSession(session)
  session.regenerateId(true)
  return redirect(routes.home.href())
}
