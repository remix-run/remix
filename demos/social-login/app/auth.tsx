import type { Controller, RequestHandler } from 'remix/fetch-router'
import {
  createCredentialsAuthLoginRequestHandler,
  createExternalAuthCallbackRequestHandler,
  createExternalAuthLoginRequestHandler,
} from 'remix/auth'
import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import {
  ErrorPage,
  ForgotPasswordPage,
  ForgotPasswordSentPage,
  ResetPasswordCompletePage,
  ResetPasswordPage,
  SignupPage,
} from './auth/index.ts'
import {
  normalizeEmail,
  normalizeOptionalText,
  normalizeText,
  passwordResetTokens,
  users,
} from './data/schema.ts'
import {
  clearAuthenticatedSession,
  flashError,
  flashSuccess,
  getPostAuthRedirect,
  getReturnToQuery,
  passwordProvider,
  writeAuthenticatedSession,
} from './middleware/auth.ts'
import {
  createGitHubProvider,
  createGoogleProvider,
  createXProvider,
  type ExternalProviderName,
} from './providers.ts'
import { routes } from './routes.ts'
import { resolveExternalLogin } from './social-auth.ts'
import { hashPassword } from './utils/password.ts'
import { render } from './utils/render.tsx'
import { Session } from './utils/session.ts'

let signupSchema = f.object({
  name: f.field(s.string().pipe(minLength(1))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(8))),
})

let forgotPasswordSchema = f.object({
  email: f.field(s.string().pipe(email())),
})

let resetPasswordSchema = f.object({
  password: f.field(s.string().pipe(minLength(8))),
  confirmPassword: f.field(s.string().pipe(minLength(8))),
})

let authController: Controller<typeof routes.auth> = {
  actions: {
    login: createCredentialsAuthLoginRequestHandler(passwordProvider, {
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
    }),

    logout(context) {
      let session = context.get(Session)
      clearAuthenticatedSession(session)
      session.regenerateId(true)
      return redirect(routes.home.href())
    },

    signup: {
      actions: {
        index(context) {
          return render(
            <SignupPage
              formAction={routes.auth.signup.action.href(undefined, getReturnToQuery(context.url))}
              loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
            />,
          )
        },

        async action(context) {
          let result = s.parseSafe(signupSchema, context.get(FormData))
          if (!result.success) {
            return render(
              <SignupPage
                formAction={routes.auth.signup.action.href(undefined, getReturnToQuery(context.url))}
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
                error={getIssueMessage(result.issues)}
                values={readSignupValues(context.get(FormData))}
              />,
              { status: 400 },
            )
          }

          let signup = result.value
          let name = normalizeText(signup.name)
          let emailAddress = normalizeEmail(signup.email)
          let existingUser = await context.db.findOne(users, { where: { email: emailAddress } })

          if (existingUser != null) {
            return render(
              <SignupPage
                formAction={routes.auth.signup.action.href(undefined, getReturnToQuery(context.url))}
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
                error="An account with that email already exists."
                values={{ name, email: emailAddress }}
              />,
              { status: 400 },
            )
          }

          let user = await context.db.create(
            users,
            {
              email: emailAddress,
              password_hash: await hashPassword(signup.password),
              name,
            },
            { returnRow: true },
          )

          let session = context.get(Session)
          session.regenerateId(true)
          writeAuthenticatedSession(session, {
            userId: user.id,
            loginMethod: 'credentials',
          })

          return redirect(getPostAuthRedirect(context.url))
        },
      },
    },

    forgotPassword: {
      actions: {
        index(context) {
          return render(
            <ForgotPasswordPage
              formAction={routes.auth.forgotPassword.action.href(undefined, getReturnToQuery(context.url))}
              loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
            />,
          )
        },

        async action(context) {
          let result = s.parseSafe(forgotPasswordSchema, context.get(FormData))
          if (!result.success) {
            return render(
              <ForgotPasswordPage
                formAction={routes.auth.forgotPassword.action.href(undefined, getReturnToQuery(context.url))}
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
                error={getIssueMessage(result.issues)}
                email={readField(context.get(FormData), 'email')}
              />,
              { status: 400 },
            )
          }

          let forgotPassword = result.value
          let emailAddress = normalizeEmail(forgotPassword.email)
          let user = await context.db.findOne(users, { where: { email: emailAddress } })
          let resetHref: string | undefined

          if (user != null) {
            let token = crypto.randomUUID().replaceAll('-', '')
            await context.db.create(passwordResetTokens, {
              token,
              user_id: user.id,
              expires_at: Date.now() + 1000 * 60 * 60,
            })
            resetHref = new URL(
              routes.auth.resetPassword.index.href({ token }),
              context.url.origin,
            ).toString()
          }

          return render(
            <ForgotPasswordSentPage
              email={emailAddress}
              loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
              resetHref={resetHref}
            />,
          )
        },
      },
    },

    resetPassword: {
      actions: {
        async index(context) {
          let resetToken = await loadResetToken(context, context.params.token)
          if (resetToken == null) {
            return render(
              <ErrorPage
                title="Reset Link Expired"
                message="That password reset link is missing or has expired."
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
              />,
              { status: 400 },
            )
          }

          return render(
            <ResetPasswordPage
              formAction={routes.auth.resetPassword.action.href(
                { token: context.params.token },
                getReturnToQuery(context.url),
              )}
              loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
            />,
          )
        },

        async action(context) {
          let resetToken = await loadResetToken(context, context.params.token)
          if (resetToken == null) {
            return render(
              <ErrorPage
                title="Reset Link Expired"
                message="That password reset link is missing or has expired."
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
              />,
              { status: 400 },
            )
          }

          let result = s.parseSafe(resetPasswordSchema, context.get(FormData))
          if (!result.success) {
            return render(
              <ResetPasswordPage
                formAction={routes.auth.resetPassword.action.href(
                  { token: context.params.token },
                  getReturnToQuery(context.url),
                )}
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
                error={getIssueMessage(result.issues)}
              />,
              { status: 400 },
            )
          }

          let resetPassword = result.value
          if (resetPassword.password !== resetPassword.confirmPassword) {
            return render(
              <ResetPasswordPage
                formAction={routes.auth.resetPassword.action.href(
                  { token: context.params.token },
                  getReturnToQuery(context.url),
                )}
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
                error="Passwords must match."
              />,
              { status: 400 },
            )
          }

          let user = await context.db.find(users, resetToken.user_id)
          if (user == null) {
            await context.db.delete(passwordResetTokens, { token: resetToken.token })
            return render(
              <ErrorPage
                title="Account Not Found"
                message="The account for that reset link no longer exists."
                loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
              />,
              { status: 400 },
            )
          }

          await context.db.update(users, user.id, {
            password_hash: await hashPassword(resetPassword.password),
          })
          await context.db.delete(passwordResetTokens, { token: resetToken.token })

          let session = context.get(Session)
          flashSuccess(session, 'Password updated. You can sign in now.')

          return render(
            <ResetPasswordCompletePage
              loginHref={routes.home.href(undefined, getReturnToQuery(context.url))}
            />,
          )
        },
      },
    },

    google: {
      actions: {
        login: createExternalLoginAction('google'),
        callback: createExternalCallbackAction('google'),
      },
    },

    github: {
      actions: {
        login: createExternalLoginAction('github'),
        callback: createExternalCallbackAction('github'),
      },
    },

    x: {
      actions: {
        login: createExternalLoginAction('x'),
        callback: createExternalCallbackAction('x'),
      },
    },
  },
}

export default authController

function createExternalLoginAction(providerName: ExternalProviderName): RequestHandler {
  return async context => {
    let provider = getExternalProvider(providerName, context)
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
  }
}

function createExternalCallbackAction(providerName: ExternalProviderName): RequestHandler {
  switch (providerName) {
    case 'google':
      return async context => {
        let provider = createGoogleProvider(context)
        if (provider == null) {
          let session = context.get(Session)
          flashError(session, 'Google login is not configured.')
          return redirect(routes.home.href())
        }

        return createExternalAuthCallbackRequestHandler(provider, {
          async writeSession(session, result, actionContext) {
            let { user, authAccount } = await resolveExternalLogin(actionContext.db, result)
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

    case 'github':
      return async context => {
        let provider = createGitHubProvider(context)
        if (provider == null) {
          let session = context.get(Session)
          flashError(session, 'GitHub login is not configured.')
          return redirect(routes.home.href())
        }

        return createExternalAuthCallbackRequestHandler(provider, {
          async writeSession(session, result, actionContext) {
            let { user, authAccount } = await resolveExternalLogin(actionContext.db, result)
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

    case 'x':
      return async context => {
        let provider = createXProvider(context)
        if (provider == null) {
          let session = context.get(Session)
          flashError(session, 'X login is not configured.')
          return redirect(routes.home.href())
        }

        return createExternalAuthCallbackRequestHandler(provider, {
          async writeSession(session, result, actionContext) {
            let { user, authAccount } = await resolveExternalLogin(actionContext.db, result)
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
}

function getExternalProvider(providerName: ExternalProviderName, context: Parameters<RequestHandler>[0]) {
  switch (providerName) {
    case 'google':
      return createGoogleProvider(context)
    case 'github':
      return createGitHubProvider(context)
    case 'x':
      return createXProvider(context)
  }
}

async function loadResetToken(context: Parameters<RequestHandler>[0], token: string) {
  let resetToken = await context.db.find(passwordResetTokens, { token })
  if (resetToken == null) {
    return null
  }

  if (resetToken.expires_at <= Date.now()) {
    await context.db.delete(passwordResetTokens, { token })
    return null
  }

  return resetToken
}

function getIssueMessage(issues: ReadonlyArray<{ message: string }>): string {
  return issues[0]?.message ?? 'Please review the form and try again.'
}

function readSignupValues(formData: FormData): { name?: string; email?: string } {
  return {
    name: normalizeOptionalText(readField(formData, 'name') ?? ''),
    email: normalizeOptionalText(readField(formData, 'email') ?? ''),
  }
}

function readField(formData: FormData, name: string): string | undefined {
  let value = formData.get(name)
  return typeof value === 'string' ? value : undefined
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
