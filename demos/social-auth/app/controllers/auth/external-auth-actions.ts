import {
  createExternalAuthCallbackRequestHandler,
  createExternalAuthLoginRequestHandler,
} from 'remix/auth'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import type { SocialAuthRouteContext, SocialAuthRouter } from '../../router.ts'
import type { ExternalProviderName } from '../../utils/external-auth.ts'
import {
  createGitHubProvider,
  createGoogleProvider,
  createXProvider,
} from '../../utils/external-auth.ts'
import { writeAuthenticatedSession } from '../../utils/auth-session.ts'
import { flashError, getReturnToQuery } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { Session } from '../../middleware/session.ts'
import { resolveExternalAuth } from './resolve-external-auth.ts'

export function mountExternalProviderRoutes(
  router: SocialAuthRouter,
  providerName: ExternalProviderName,
): void {
  router.get('/login', context => startExternalLogin(providerName, context))
  router.get('/callback', context => finishExternalLogin(providerName, context))
}

function startExternalLogin(
  providerName: ExternalProviderName,
  context: SocialAuthRouteContext,
): Response | Promise<Response> {
  let provider = readExternalProvider(providerName, context)
  if (provider == null) {
    let session = context.get(Session)
    flashError(session, `${formatProviderLabel(providerName)} login is not configured.`)
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  }

  return createExternalAuthLoginRequestHandler(provider, {
    failureRedirectTo: routes.home.href(undefined, getReturnToQuery(context.url)),
    onError(_error, actionContext: SocialAuthRouteContext) {
      let session = actionContext.get(Session)
      flashError(session, `We could not start ${formatProviderLabel(providerName)} login.`)
      return redirect(routes.home.href(undefined, getReturnToQuery(actionContext.url)))
    },
  })(context)
}

function finishExternalLogin(
  providerName: ExternalProviderName,
  context: SocialAuthRouteContext,
): Response | Promise<Response> {
  switch (providerName) {
    case 'google': {
      let provider = createGoogleProvider(context)
      if (provider == null) {
        let session = context.get(Session)
        flashError(session, 'Google login is not configured.')
        return redirect(routes.home.href())
      }

      return createExternalAuthCallbackRequestHandler(provider, {
        async writeSession(session, result, actionContext: SocialAuthRouteContext) {
          let db = actionContext.get(Database)
          let { user, authAccount } = await resolveExternalAuth(db, result)
          writeAuthenticatedSession(session, {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })
        },
        successRedirectTo: routes.account.href(),
        onFailure(_error, actionContext: SocialAuthRouteContext) {
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
        async writeSession(session, result, actionContext: SocialAuthRouteContext) {
          let db = actionContext.get(Database)
          let { user, authAccount } = await resolveExternalAuth(db, result)
          writeAuthenticatedSession(session, {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })
        },
        successRedirectTo: routes.account.href(),
        onFailure(_error, actionContext: SocialAuthRouteContext) {
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
        async writeSession(session, result, actionContext: SocialAuthRouteContext) {
          let db = actionContext.get(Database)
          let { user, authAccount } = await resolveExternalAuth(db, result)
          writeAuthenticatedSession(session, {
            userId: user.id,
            loginMethod: result.provider,
            authAccountId: authAccount.id,
          })
        },
        successRedirectTo: routes.account.href(),
        onFailure(_error, actionContext: SocialAuthRouteContext) {
          let session = actionContext.get(Session)
          flashError(session, 'We could not finish X login.')
          return redirect(routes.home.href())
        },
      })(context)
    }
  }
}

function readExternalProvider(providerName: ExternalProviderName, context: SocialAuthRouteContext) {
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
  }
}
