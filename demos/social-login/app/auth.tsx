import type { Controller, RequestContext } from 'remix/fetch-router'
import { callback, login } from 'remix/auth'
import type { RequestHandler } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

import type { SocialLoginConfig } from './config.ts'
import { routes } from './routes.ts'
import {
  clearAuthenticatedSession,
  createSocialAuthProvider,
  getLoginMethodLabel,
  getProviderUnavailableMessage,
  passwordProvider,
  type SocialAuthResult,
  type SocialProviderName,
  upsertSocialUser,
  writeAuthenticatedSession,
} from './middleware/auth.ts'
import { AppDatabase } from './middleware/database.ts'
import { Session } from './utils/session.ts'

export function createAuthController(config: SocialLoginConfig): Controller<typeof routes.auth> {
  return {
    actions: {
      login: {
        actions: {
          index() {
            return redirect(routes.home.href())
          },
          action: login(passwordProvider, {
            writeSession(session, user) {
              writeAuthenticatedSession(session, user, 'password')
            },
            onFailure(context) {
              return redirectWithError(context, 'Invalid email or password.')
            },
            onSuccess() {
              return redirect(routes.home.href())
            },
          }),
        },
      },
      google: {
        actions: {
          login: createSocialLoginAction('google', config),
          callback: createSocialCallbackAction('google', config),
        },
      },
      github: {
        actions: {
          login: createSocialLoginAction('github', config),
          callback: createSocialCallbackAction('github', config),
        },
      },
      facebook: {
        actions: {
          login: createSocialLoginAction('facebook', config),
          callback: createSocialCallbackAction('facebook', config),
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

function createSocialLoginAction(
  name: SocialProviderName,
  config: SocialLoginConfig,
): RequestHandler {
  return context => {
    let provider = createSocialAuthProvider(name, context.url.origin, config)

    if (provider == null) {
      return redirectWithError(context, getProviderUnavailableMessage(name, config))
    }

    return login(provider, {
      onError(error, failureContext) {
        return redirectWithError(
          failureContext,
          `${getLoginMethodLabel(name)} login failed. ${getErrorMessage(error)}`,
        )
      },
    })(context)
  }
}

function createSocialCallbackAction(
  name: SocialProviderName,
  config: SocialLoginConfig,
): RequestHandler {
  return context => {
    let provider = createSocialAuthProvider(name, context.url.origin, config)

    if (provider == null) {
      return redirectWithError(context, getProviderUnavailableMessage(name, config))
    }

    return callback(provider, {
      async writeSession(session, result, callbackContext) {
        let user = await upsertSocialUser(
          callbackContext.get(AppDatabase),
          result as SocialAuthResult,
        )
        writeAuthenticatedSession(session, user, result.provider)
      },
      onSuccess() {
        return redirect(routes.home.href())
      },
      onFailure(error, failureContext) {
        return redirectWithError(
          failureContext,
          `${getLoginMethodLabel(name)} login failed. ${getErrorMessage(error)}`,
        )
      },
    })(context)
  }
}

function redirectWithError(context: RequestContext, message: string): Response {
  let session = context.get(Session)
  session.flash('error', message)
  return redirect(routes.home.href())
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Please try again.'
}
