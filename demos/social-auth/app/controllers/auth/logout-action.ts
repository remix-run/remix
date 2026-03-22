import { redirect } from 'remix/response/redirect'

import { Session } from '../../middleware/session.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'

export function logout(context: AppContext) {
  let session = context.get(Session)
  session.unset('auth')
  session.regenerateId(true)
  return redirect(routes.home.href())
}
