import {
  completeAuth,
  finishExternalAuth,
  startExternalAuth,
} from 'remix/auth'
import { Database } from 'remix/data-table'
import type { Controller } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import { resolveExternalAuth } from '../resolve-external-auth.ts'
import { getReturnToQuery } from '../../../middleware/auth.ts'
import { Session } from '../../../middleware/session.ts'
import type { AppContext } from '../../../router.ts'
import { routes } from '../../../routes.ts'
import {
  createAtmosphereProvider,
  getExternalProviderLabel,
  externalProviderRegistry,
  type ExternalProviderRegistry,
} from '../../../utils/external-auth.ts'

const label = getExternalProviderLabel('atmosphere')
const atmosphereIdentifierSessionKey = '__atmosphere_identifier'

export function createAtmosphereAuthController(
  registry: ExternalProviderRegistry = externalProviderRegistry,
) {
  return {
    actions: {
      async login(context: AppContext) {
        let identifier = normalizeAtmosphereIdentifier(context.url.searchParams.get('handleOrDid'))

        if (identifier == null) {
          let session = context.get(Session)
          session.flash('error', 'Enter a Bluesky handle or DID to start Atmosphere login.')
          return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
        }

        let session = context.get(Session)
        session.set(atmosphereIdentifierSessionKey, identifier)

        try {
          let provider = await createAtmosphereProvider(identifier, registry)

          return await startExternalAuth(provider, context, {
            returnTo: context.url.searchParams.get('returnTo'),
          })
        } catch {
          session.unset(atmosphereIdentifierSessionKey)
          session.flash('error', `We could not start ${label} login.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
        }
      },

      async callback(context: AppContext) {
        let session = context.get(Session)
        let identifier = normalizeAtmosphereIdentifier(
          session.get(atmosphereIdentifierSessionKey) as string | null | undefined,
        )

        if (identifier == null) {
          session.flash('error', `We could not finish ${label} login.`)
          return redirect(routes.home.href())
        }

        try {
          let provider = await createAtmosphereProvider(identifier, registry)
          let { result, returnTo } = await finishExternalAuth(provider, context)
          session.unset(atmosphereIdentifierSessionKey)

          let db = context.get(Database)
          let { user, authAccount } = await resolveExternalAuth(db, result)
          let authSession = completeAuth(context)
          authSession.set('auth', {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })

          return redirect(returnTo ?? routes.account.href())
        } catch {
          session.unset(atmosphereIdentifierSessionKey)
          session.flash('error', `We could not finish ${label} login.`)
          return redirect(routes.home.href())
        }
      },
    },
  } satisfies Controller<typeof routes.auth.atmosphere, AppContext>
}

function normalizeAtmosphereIdentifier(value: string | null | undefined): string | null {
  let trimmed = value?.trim()
  return trimmed ? trimmed : null
}