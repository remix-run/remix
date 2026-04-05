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
import { persistAuthAccountTokens } from '../../../utils/auth-account-tokens.ts'

const label = getExternalProviderLabel('github')

export function createGitHubAuthController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  let provider = registry.github

  return {
    actions: {
      async login(context: AppContext) {
        if (provider == null) {
          let session = context.get(Session)
          session.flash('error', `${label} login is not configured.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
        }

        try {
          return await startExternalAuth(provider, context, {
            returnTo: context.url.searchParams.get('returnTo'),
          })
        } catch {
          let session = context.get(Session)
          session.flash('error', `We could not start ${label} login.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
        }
      },

      async callback(context: AppContext) {
        if (provider == null) {
          let session = context.get(Session)
          session.flash('error', `${label} login is not configured.`)
          return redirect(routes.home.href())
        }

        try {
          let { result, returnTo } = await finishExternalAuth(provider, context)

          let db = context.get(Database)
          let { user, authAccount } = await resolveExternalAuth(db, result)
          await persistAuthAccountTokens(db, authAccount.id, result.tokens)
          let session = completeAuth(context)
          session.set('auth', {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })

          return redirect(returnTo ?? routes.account.href())
        } catch {
          let session = context.get(Session)
          session.flash('error', `We could not finish ${label} login.`)
          return redirect(routes.home.href())
        }
      },
    },
  } satisfies Controller<typeof routes.auth.github, AppContext>
}
