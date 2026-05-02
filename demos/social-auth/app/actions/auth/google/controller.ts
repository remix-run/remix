import { completeAuth, finishExternalAuth, startExternalAuth } from 'remix/auth'
import { Database } from 'remix/data-table'
import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { resolveExternalAuth } from '../resolve-external-auth.ts'
import { getReturnToQuery } from '../../../middleware/auth.ts'
import { Session } from '../../../middleware/session.ts'
import type { AppContext } from '../../../router.ts'
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

  return {
    actions: {
      async login(context) {
        let { get, url } = context

        if (provider == null) {
          let session = get(Session)
          session.flash('error', `${label} login is not configured.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }

        try {
          return await startExternalAuth(provider, context, {
            returnTo: url.searchParams.get('returnTo'),
          })
        } catch {
          let session = get(Session)
          session.flash('error', `We could not start ${label} login.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(url)))
        }
      },

      async callback(context) {
        let { get } = context

        if (provider == null) {
          let session = get(Session)
          session.flash('error', `${label} login is not configured.`)
          return redirect(routes.home.href())
        }

        try {
          let { result, returnTo } = await finishExternalAuth(provider, context)

          let db = get(Database)
          let { user, authAccount } = await resolveExternalAuth(db, result)
          let session = completeAuth(context)
          session.set('auth', {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })

          return redirect(returnTo ?? routes.account.href())
        } catch {
          let session = get(Session)
          session.flash('error', `We could not finish ${label} login.`)
          return redirect(routes.home.href())
        }
      },
    },
  } satisfies Controller<typeof routes.auth.google, AppContext>
}
