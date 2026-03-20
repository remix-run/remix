import {
  createExternalAuthCallbackRequestHandler,
  createExternalAuthLoginRequestHandler,
} from 'remix/auth'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { resolveExternalAuth } from './resolve-external-auth.ts'
import { flashError, getReturnToQuery } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import type { SocialAuthRouteContext, SocialAuthRouter } from '../../router.ts'
import { routes } from '../../routes.ts'
import {
  createExternalProvider,
  getExternalProviderLabel,
  type ExternalProviderName,
} from '../../utils/external-auth.ts'
import { writeAuthenticatedSession } from '../../utils/auth-session.ts'

export function mountExternalProviderRoutes(router: SocialAuthRouter): void {
  router.mount('/google', google => mountProviderRoutes(google, 'google'))
  router.mount('/github', github => mountProviderRoutes(github, 'github'))
  router.mount('/x', x => mountProviderRoutes(x, 'x'))
}

function mountProviderRoutes<name extends ExternalProviderName>(
  router: SocialAuthRouter,
  providerName: name,
): void {
  router.get('/login', context => startExternalLogin(providerName, context))
  router.get('/callback', context => finishExternalLogin(providerName, context))
}

function startExternalLogin<name extends ExternalProviderName>(
  providerName: name,
  context: SocialAuthRouteContext,
): Response | Promise<Response> {
  let provider = createExternalProvider(providerName, context)
  if (provider == null) {
    let session = context.get(Session)
    flashError(session, `${getExternalProviderLabel(providerName)} login is not configured.`)
    return redirect(routes.home.href(undefined, getReturnToQuery(context.url)))
  }

  return createExternalAuthLoginRequestHandler(provider, {
    failureRedirectTo: routes.home.href(undefined, getReturnToQuery(context.url)),
    onError(_error, actionContext: SocialAuthRouteContext) {
      let session = actionContext.get(Session)
      flashError(session, `We could not start ${getExternalProviderLabel(providerName)} login.`)
      return redirect(routes.home.href(undefined, getReturnToQuery(actionContext.url)))
    },
  })(context)
}

function finishExternalLogin(
  providerName: ExternalProviderName,
  context: SocialAuthRouteContext,
): Response | Promise<Response> {
  switch (providerName) {
    case 'google':
      return finishExternalLoginWithProvider('google', context)
    case 'github':
      return finishExternalLoginWithProvider('github', context)
    case 'x':
      return finishExternalLoginWithProvider('x', context)
  }
}

function finishExternalLoginWithProvider<name extends ExternalProviderName>(
  providerName: name,
  context: SocialAuthRouteContext,
): Response | Promise<Response> {
  let provider = createExternalProvider(providerName, context)
  if (provider == null) {
    let session = context.get(Session)
    flashError(session, `${getExternalProviderLabel(providerName)} login is not configured.`)
    return redirect(routes.home.href())
  }

  return createExternalAuthCallbackRequestHandler(provider, {
    async writeSession(session, result, actionContext: SocialAuthRouteContext) {
      let db = actionContext.get(Database)
      // The auth callback factory loses provider/profile correlation through this generic wrapper,
      // but the providerName above still determines the runtime result shape.
      let externalAuthResult = result as Parameters<typeof resolveExternalAuth>[1]
      let { user, authAccount } = await resolveExternalAuth(db, externalAuthResult)
      writeAuthenticatedSession(session, {
        userId: user.id,
        loginMethod: result.provider,
        authAccountId: authAccount.id,
      })
    },
    successRedirectTo: routes.account.href(),
    onFailure(_error, actionContext: SocialAuthRouteContext) {
      let session = actionContext.get(Session)
      flashError(session, `We could not finish ${getExternalProviderLabel(providerName)} login.`)
      return redirect(routes.home.href())
    },
  })(context)
}
