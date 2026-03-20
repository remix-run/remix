import { createCredentialsAuthLoginRequestHandler } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import type { SocialAuthRouteContext } from '../../router.ts'
import { writeAuthenticatedSession } from '../../utils/auth-session.ts'
import { flashError, getPostAuthRedirect, getReturnToQuery, passwordProvider } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { Session } from '../../middleware/session.ts'

export let login = createCredentialsAuthLoginRequestHandler(passwordProvider, {
  writeSession(session, user) {
    writeAuthenticatedSession(session, {
      userId: user.id,
      loginMethod: 'credentials',
    })
  },
  onFailure(context: SocialAuthRouteContext) {
    let session = context.get(Session)
    flashError(session, 'Invalid email or password. Please try again.')
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  },
  onSuccess(_user, context: SocialAuthRouteContext) {
    return redirect(getPostAuthRedirect(context.url))
  },
  onError(_error, context: SocialAuthRouteContext) {
    let session = context.get(Session)
    flashError(session, 'We could not complete that sign-in request.')
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  },
})
