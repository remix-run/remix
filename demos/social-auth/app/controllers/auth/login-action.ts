import type { BuildAction } from 'remix/fetch-router'
import { createCredentialsAuthLoginRequestHandler } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import { writeAuthenticatedSession } from '../../models/auth-session.ts'
import { flashError, getPostAuthRedirect, getReturnToQuery, passwordProvider } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { Session } from '../../utils/session.ts'

export let loginAction = createCredentialsAuthLoginRequestHandler(passwordProvider, {
  writeSession(session, user) {
    writeAuthenticatedSession(session, {
      userId: user.id,
      loginMethod: 'credentials',
    })
  },
  onFailure(context) {
    let session = context.get(Session)
    flashError(session, 'Invalid email or password. Please try again.')
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  },
  onSuccess(_user, context) {
    return redirect(getPostAuthRedirect(context.url))
  },
  onError(_error, context) {
    let session = context.get(Session)
    flashError(session, 'We could not complete that sign-in request.')
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  },
}) satisfies BuildAction<'POST', typeof routes.auth.login>
