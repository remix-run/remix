import { createCredentialsAuthLoginRequestHandler } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { getPostAuthRedirect, getReturnToQuery, passwordProvider } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'

export let login = createCredentialsAuthLoginRequestHandler(passwordProvider, {
  writeSession(session, user) {
    session.set('auth', {
      userId: user.id,
      loginMethod: 'credentials',
    })
  },
  onFailure(context: AppContext) {
    let session = context.get(Session)
    session.flash('error', 'Invalid email or password. Please try again.')
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  },
  onSuccess(_user, context: AppContext) {
    return redirect(getPostAuthRedirect(context.url))
  },
  onError(_error, context: AppContext) {
    let session = context.get(Session)
    session.flash('error', 'We could not complete that sign-in request.')
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  },
})
