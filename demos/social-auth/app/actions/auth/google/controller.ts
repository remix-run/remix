import { completeAuth, finishExternalAuth, startExternalAuth } from 'remix/auth'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { resolveExternalAuth } from '../resolve-external-auth.ts'
import { getReturnToQuery } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'
import {
  externalProviderRegistry,
  getExternalProviderLabel,
  type ExternalProviderRegistry,
} from '../../../utils/external-auth.ts'

const label = getExternalProviderLabel('google')

export function createGoogleAuthController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  let provider = registry.google

  return createController(routes.auth.google, {
    actions: {
      async login(context) {
        let { session, url } = context

        if (provider == null) {
          session.flash('error', `${label} login is not configured.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }

        try {
          return await startExternalAuth(provider, context, {
            returnTo: url.searchParams.get('returnTo'),
          })
        } catch {
          session.flash('error', `We could not start ${label} login.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }
      },

      async callback(context) {
        let { db, session } = context

        if (provider == null) {
          session.flash('error', `${label} login is not configured.`)
          return redirect(routes.home.href())
        }

        try {
          let { result, returnTo } = await finishExternalAuth(provider, context)

          let { user, authAccount } = await resolveExternalAuth(db, result)
          let authSession = completeAuth(context)
          authSession.set('auth', {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })

          return redirect(returnTo ?? routes.account.href())
        } catch {
          session.flash('error', `We could not finish ${label} login.`)
          return redirect(routes.home.href())
        }
      },
    },
  })
}
