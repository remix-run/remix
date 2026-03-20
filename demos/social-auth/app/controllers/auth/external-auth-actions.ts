import type { BuildAction, Controller, RequestContext } from 'remix/fetch-router'
import {
  createExternalAuthCallbackRequestHandler,
  createExternalAuthLoginRequestHandler,
} from 'remix/auth'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import type { ExternalProviderName } from '../../integrations/external-auth/provider-config.ts'
import { createGitHubProvider } from '../../integrations/external-auth/github.ts'
import { createGoogleProvider } from '../../integrations/external-auth/google.ts'
import { createXProvider } from '../../integrations/external-auth/x.ts'
import { writeAuthenticatedSession } from '../../models/auth-session.ts'
import { flashError, getReturnToQuery } from '../../middleware/auth.ts'
import { resolveExternalAuth } from '../../operations/resolve-external-auth.ts'
import { routes } from '../../routes.ts'
import { Session } from '../../utils/session.ts'

export function createExternalProviderActions(providerName: ExternalProviderName) {
  return {
    actions: {
      login: createExternalLoginAction(providerName),
      callback: createExternalCallbackAction(providerName),
    },
  } satisfies Controller<typeof routes.auth.google>
}

function createExternalLoginAction(providerName: ExternalProviderName) {
  return {
    async action(context) {
      let provider = readExternalProvider(providerName, context)
      if (provider == null) {
        let session = context.get(Session)
        flashError(session, `${formatProviderLabel(providerName)} login is not configured.`)
        return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
      }

      return createExternalAuthLoginRequestHandler(provider, {
        failureRedirectTo: routes.home.href(undefined, getReturnToQuery(context.url)),
        onError(_error, actionContext) {
          let session = actionContext.get(Session)
          flashError(session, `We could not start ${formatProviderLabel(providerName)} login.`)
          return redirect(routes.home.href(undefined, getReturnToQuery(actionContext.url)))
        },
      })(context)
    },
  } satisfies BuildAction<'GET', typeof routes.auth.google.login>
}

function createExternalCallbackAction(providerName: ExternalProviderName) {
  return {
    async action(context) {
      switch (providerName) {
        case 'google': {
          let provider = createGoogleProvider(context)
          if (provider == null) {
            let session = context.get(Session)
            flashError(session, 'Google login is not configured.')
            return redirect(routes.home.href())
          }

          return createExternalAuthCallbackRequestHandler(provider, {
            async writeSession(session, result, actionContext) {
              let db = actionContext.get(Database)
              let { user, authAccount } = await resolveExternalAuth(db, result)
              writeAuthenticatedSession(session, {
                userId: user.id,
                loginMethod: result.provider,
                authAccountId: authAccount.id,
              })
            },
            successRedirectTo: routes.account.href(),
            onFailure(_error, actionContext) {
              let session = actionContext.get(Session)
              flashError(session, 'We could not finish Google login.')
              return redirect(routes.home.href())
            },
          })(context)
        }

        case 'github': {
          let provider = createGitHubProvider(context)
          if (provider == null) {
            let session = context.get(Session)
            flashError(session, 'GitHub login is not configured.')
            return redirect(routes.home.href())
          }

          return createExternalAuthCallbackRequestHandler(provider, {
            async writeSession(session, result, actionContext) {
              let db = actionContext.get(Database)
              let { user, authAccount } = await resolveExternalAuth(db, result)
              writeAuthenticatedSession(session, {
                userId: user.id,
                loginMethod: result.provider,
                authAccountId: authAccount.id,
              })
            },
            successRedirectTo: routes.account.href(),
            onFailure(_error, actionContext) {
              let session = actionContext.get(Session)
              flashError(session, 'We could not finish GitHub login.')
              return redirect(routes.home.href())
            },
          })(context)
        }

        case 'x': {
          let provider = createXProvider(context)
          if (provider == null) {
            let session = context.get(Session)
            flashError(session, 'X login is not configured.')
            return redirect(routes.home.href())
          }

          return createExternalAuthCallbackRequestHandler(provider, {
            async writeSession(session, result, actionContext) {
              let db = actionContext.get(Database)
              let { user, authAccount } = await resolveExternalAuth(db, result)
              writeAuthenticatedSession(session, {
                userId: user.id,
                loginMethod: result.provider,
                authAccountId: authAccount.id,
              })
            },
            successRedirectTo: routes.account.href(),
            onFailure(_error, actionContext) {
              let session = actionContext.get(Session)
              flashError(session, 'We could not finish X login.')
              return redirect(routes.home.href())
            },
          })(context)
        }
      }
    },
  } satisfies BuildAction<'GET', typeof routes.auth.google.callback>
}

function readExternalProvider(providerName: ExternalProviderName, context: RequestContext) {
  switch (providerName) {
    case 'google':
      return createGoogleProvider(context)
    case 'github':
      return createGitHubProvider(context)
    case 'x':
      return createXProvider(context)
  }
}

function formatProviderLabel(providerName: ExternalProviderName): string {
  switch (providerName) {
    case 'google':
      return 'Google'
    case 'github':
      return 'GitHub'
    case 'x':
      return 'X'
    default:
      throw new Error('Unknown provider')
  }
}
