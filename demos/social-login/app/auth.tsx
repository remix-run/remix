import type { Controller, RequestContext } from 'remix/fetch-router'
import { callback, login } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

import type { SocialLoginConfig } from './config.ts'
import { routes } from './routes.ts'
import {
  clearAuthenticatedSession,
  createAuthenticatedUser,
  createFacebookProvider,
  createGitHubProvider,
  createGoogleProvider,
  getProviderLabel,
  getProviderUnavailableMessage,
  writeAuthenticatedSession,
} from './middleware/auth.ts'
import { Session } from './utils/session.ts'

export function createAuthController(config: SocialLoginConfig): Controller<typeof routes.auth> {
  return {
    actions: {
      google: {
        actions: {
          login(context: RequestContext) {
            return handleGoogleLogin(context, config)
          },
          callback(context: RequestContext) {
            return handleGoogleCallback(context, config)
          },
        },
      },
      github: {
        actions: {
          login(context: RequestContext) {
            return handleGitHubLogin(context, config)
          },
          callback(context: RequestContext) {
            return handleGitHubCallback(context, config)
          },
        },
      },
      facebook: {
        actions: {
          login(context: RequestContext) {
            return handleFacebookLogin(context, config)
          },
          callback(context: RequestContext) {
            return handleFacebookCallback(context, config)
          },
        },
      },
      logout({ get }) {
        let session = get(Session)
        clearAuthenticatedSession(session)
        session.regenerateId(true)

        return redirect(routes.home.href())
      },
    },
  }
}

function handleGoogleLogin(context: RequestContext, config: SocialLoginConfig): Response | Promise<Response> {
  let provider = createGoogleProvider(context.url.origin, config)

  if (provider == null) {
    return redirectWithError(context, getProviderUnavailableMessage('google', config))
  }

  return login(provider)(context)
}

function handleGoogleCallback(
  context: RequestContext,
  config: SocialLoginConfig,
): Response | Promise<Response> {
  let provider = createGoogleProvider(context.url.origin, config)

  if (provider == null) {
    return redirectWithError(context, getProviderUnavailableMessage('google', config))
  }

  return callback(provider, {
    writeSession(session, result) {
      writeAuthenticatedSession(session, createAuthenticatedUser(result))
    },
    onSuccess() {
      return redirect(routes.home.href())
    },
    onFailure(error, failureContext) {
      let message = error instanceof Error && error.message
        ? `${getProviderLabel('google')} login failed. ${error.message}`
        : `${getProviderLabel('google')} login failed.`

      return redirectWithError(failureContext, message)
    },
  })(context)
}

function handleGitHubLogin(context: RequestContext, config: SocialLoginConfig): Response | Promise<Response> {
  let provider = createGitHubProvider(context.url.origin, config)

  if (provider == null) {
    return redirectWithError(context, getProviderUnavailableMessage('github', config))
  }

  return login(provider)(context)
}

function handleGitHubCallback(
  context: RequestContext,
  config: SocialLoginConfig,
): Response | Promise<Response> {
  let provider = createGitHubProvider(context.url.origin, config)

  if (provider == null) {
    return redirectWithError(context, getProviderUnavailableMessage('github', config))
  }

  return callback(provider, {
    writeSession(session, result) {
      writeAuthenticatedSession(session, createAuthenticatedUser(result))
    },
    onSuccess() {
      return redirect(routes.home.href())
    },
    onFailure(error, failureContext) {
      let message = error instanceof Error && error.message
        ? `${getProviderLabel('github')} login failed. ${error.message}`
        : `${getProviderLabel('github')} login failed.`

      return redirectWithError(failureContext, message)
    },
  })(context)
}

function handleFacebookLogin(
  context: RequestContext,
  config: SocialLoginConfig,
): Response | Promise<Response> {
  let provider = createFacebookProvider(context.url.origin, config)

  if (provider == null) {
    return redirectWithError(context, getProviderUnavailableMessage('facebook', config))
  }

  return login(provider)(context)
}

function handleFacebookCallback(
  context: RequestContext,
  config: SocialLoginConfig,
): Response | Promise<Response> {
  let provider = createFacebookProvider(context.url.origin, config)

  if (provider == null) {
    return redirectWithError(context, getProviderUnavailableMessage('facebook', config))
  }

  return callback(provider, {
    writeSession(session, result) {
      writeAuthenticatedSession(session, createAuthenticatedUser(result))
    },
    onSuccess() {
      return redirect(routes.home.href())
    },
    onFailure(error, failureContext) {
      let message = error instanceof Error && error.message
        ? `${getProviderLabel('facebook')} login failed. ${error.message}`
        : `${getProviderLabel('facebook')} login failed.`

      return redirectWithError(failureContext, message)
    },
  })(context)
}

function redirectWithError(context: RequestContext, message: string): Response {
  let session = context.get(Session)
  session.flash('error', message)
  return redirect(routes.home.href())
}
