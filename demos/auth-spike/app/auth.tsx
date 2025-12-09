import type { RouteHandlers } from '@remix-run/fetch-router'
import { createRedirectResponse as redirect } from '@remix-run/response/redirect'
import { routes } from './routes.ts'
import { authClient } from './utils/auth.ts'
import { render } from './utils/render.tsx'
import { Layout } from './layout.tsx'
import { sendEmail } from './services/email.ts'

// Route handlers

export default {
  handlers: {
    signUp: {
      index() {
        return render(<SignupForm />)
      },

      async action({ formData, session, request }) {
        let name = formData.get('name') as string
        let email = formData.get('email') as string
        let password = formData.get('password') as string

        let result = await authClient.password.signUp({ request, session, email, password, name })

        if ('error' in result) {
          let getErrorMessage = () => {
            switch (result.error) {
              case 'email_taken':
                return 'An account with this email already exists'
              default: {
                return 'An unknown error occurred'
              }
            }
          }
          return render(<SignupForm error={getErrorMessage()} />)
        }

        // Success - logged in (session set by auth client)
        return redirect(routes.home.href(), 302)
      },
    },

    login: {
      index({ url, session }) {
        let returnTo = url.searchParams.get('returnTo')
        let flashError: string | undefined

        // Check for OAuth flash messages
        let oauthFlash = authClient.oauth.getFlash(session)
        if (oauthFlash?.type === 'error') {
          switch (oauthFlash.code) {
            case 'access_denied':
              flashError = 'You cancelled the sign in process'
              break
            case 'account_exists_unverified_email':
              flashError =
                'An account with this email already exists. Please sign in with your original method, or use an OAuth provider that verifies your email address.'
              break
            case 'invalid_state':
              flashError = 'Invalid or expired OAuth state. Please try again.'
              break
            default:
              flashError = 'An error occurred. Please try again.'
          }
        }

        // Check for email verification flash messages
        let emailFlash = authClient.emailVerification.getFlash(session)
        if (emailFlash?.type === 'error') {
          switch (emailFlash.code) {
            case 'invalid_or_expired_token':
              flashError = 'Invalid or expired verification link. Please request a new one.'
              break
            default:
              flashError = 'An error occurred. Please try again.'
          }
        }

        return render(<LoginForm error={flashError} returnTo={returnTo} />)
      },

      async action({ formData, session, url, request }) {
        let email = formData.get('email') as string
        let password = formData.get('password') as string
        let returnTo = (formData.get('returnTo') as string) || '/'

        let result = await authClient.password.signIn({ request, session, email, password })

        if ('error' in result) {
          let getErrorMessage = () => {
            switch (result.error) {
              case 'invalid_credentials':
                return 'Invalid email or password'
              default: {
                return 'An unknown error occurred'
              }
            }
          }
          return render(<LoginForm error={getErrorMessage()} returnTo={returnTo} />)
        }

        // Success - logged in (session set by auth client)
        return redirect(returnTo, 302)
      },
    },

    forgotPassword: {
      index() {
        return render(<ForgotPasswordForm />)
      },

      async action({ formData, request }) {
        let email = formData.get('email') as string

        let result = await authClient.password.getResetToken({ email })

        // If we got a token, send the email
        if (!('error' in result)) {
          let { user, token } = result
          let baseURL = new URL(request.url).origin
          let resetFormUrl = `${baseURL}${routes.auth.resetPassword.index.href({ token })}`
          sendEmail({
            to: user.email,
            subject: 'Reset your password',
            text: `Hi ${user.name},\n\nClick the link below to reset your password:\n\n${resetFormUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
          })
        } else if (process.env.NODE_ENV === 'development') {
          // Log error in development, but don't reveal if email exists
          console.log('Password reset error:', result.error)
        }

        // Always show the same success message (don't reveal if email exists)
        return render(
          <Layout>
            <div css={{ maxWidth: '500px', margin: '4rem auto', padding: '0 20px' }}>
              <h1
                css={{
                  fontSize: '2rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em',
                }}
              >
                Check Your Email
              </h1>
              <div
                css={{
                  background: '#d4edda',
                  border: '1px solid #28a745',
                  padding: '1rem',
                  marginBottom: '1rem',
                  borderRadius: '6px',
                }}
              >
                Password reset link sent! Check your email for instructions.
              </div>
              <p css={{ fontSize: '0.875rem', color: '#6e6e73', marginBottom: '1.5rem' }}>
                <strong>Demo Mode:</strong> In production, this page wouldn't reveal whether the
                account exists, and the reset link would only be sent via email. For this demo,
                check the terminal to see the email (if sent).
              </p>
              <div css={{ marginTop: '1.5rem' }}>
                <a href={routes.auth.login.index.href()} css={{ color: '#007aff' }}>
                  Back to Login
                </a>
              </div>
            </div>
          </Layout>,
        )
      },
    },

    resetPassword: {
      index({ params }) {
        let token = params.token
        return render(<ResetPasswordForm token={token} />)
      },

      async action({ formData, params, session }) {
        let newPassword = formData.get('password') as string
        let confirmPassword = formData.get('confirmPassword') as string
        let token = params.token

        if (newPassword !== confirmPassword) {
          return render(<ResetPasswordForm token={token} error="Passwords do not match" />)
        }

        let result = await authClient.password.reset({ session, token, newPassword })

        if ('error' in result) {
          let getErrorMessage = () => {
            switch (result.error) {
              case 'invalid_or_expired_token':
                return 'Invalid or expired reset token'
              case 'user_not_found':
                return 'User not found'
              default: {
                return 'An unknown error occurred'
              }
            }
          }
          return render(<ResetPasswordForm token={token} error={getErrorMessage()} />)
        }

        // Success - send confirmation email
        sendEmail({
          to: result.user.email,
          subject: 'Your Password Has Been Reset',
          text: `Hi there,

Your password has been successfully reset.

If you didn't make this change, please contact support immediately.`,
        })

        return render(
          <Layout>
            <div css={{ maxWidth: '500px', margin: '4rem auto', padding: '0 20px' }}>
              <h1
                css={{
                  fontSize: '2rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em',
                }}
              >
                Password Reset Successful
              </h1>
              <div
                css={{
                  background: '#d4edda',
                  border: '1px solid #28a745',
                  padding: '1rem',
                  marginBottom: '1rem',
                  borderRadius: '6px',
                }}
              >
                Password reset successfully! You can now login with your new password.
              </div>
              <div css={{ marginTop: '1.5rem' }}>
                <a href={routes.auth.login.index.href()} css={{ color: '#007aff' }}>
                  Login
                </a>
              </div>
            </div>
          </Layout>,
        )
      },
    },
  },
} satisfies RouteHandlers<typeof routes.auth>

// Form components

function SignupForm({ error }: { error?: string }) {
  return (
    <Layout>
      <div css={{ maxWidth: '500px', margin: '4rem auto', padding: '0 20px' }}>
        <h1
          css={{
            fontSize: '2rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#1d1d1f',
            letterSpacing: '-0.02em',
          }}
        >
          Sign Up
        </h1>
        {error ? (
          <div
            css={{
              background: '#fff3f3',
              border: '1px solid #ffcccc',
              color: '#cc0000',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        ) : null}
        <form method="POST">
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="name"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="email"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="password"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <button
            type="submit"
            css={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: '#007aff',
              color: 'white',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',
              ':hover': {
                background: '#0051d5',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Sign Up
          </button>
        </form>

        {Object.keys(authClient.oauth.providers).length > 0 ? (
          <>
            <div
              css={{
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div css={{ flex: 1, height: '1px', background: '#d2d2d7' }} />
              <span css={{ color: '#86868b', fontSize: '0.875rem' }}>OR</span>
              <div css={{ flex: 1, height: '1px', background: '#d2d2d7' }} />
            </div>

            {Object.values(authClient.oauth.providers).map((provider) => (
              <a
                key={provider.name}
                href={provider.signInHref}
                css={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: provider.name === 'github' ? '#24292f' : '#007aff',
                  color: 'white',
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  marginBottom: '0.75rem',
                  ':hover': {
                    background: provider.name === 'github' ? '#1b1f23' : '#0051d5',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {provider.name === 'github' ? (
                  <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                ) : null}
                Continue with {provider.displayName}
              </a>
            ))}
          </>
        ) : null}

        <div css={{ marginTop: '1.5rem' }}>
          <a href={routes.auth.login.index.href()} css={{ color: '#007aff' }}>
            Already have an account? Login
          </a>
        </div>
      </div>
    </Layout>
  )
}

function LoginForm({ error, returnTo }: { error?: string; returnTo?: string | null }) {
  return (
    <Layout>
      <div css={{ maxWidth: '500px', margin: '4rem auto', padding: '0 20px' }}>
        <h1
          css={{
            fontSize: '2rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#1d1d1f',
            letterSpacing: '-0.02em',
          }}
        >
          Login
        </h1>
        {error ? (
          <div
            css={{
              background: '#fff3f3',
              border: '1px solid #ffcccc',
              color: '#cc0000',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        ) : null}
        <form method="POST">
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="email"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="password"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <button
            type="submit"
            css={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: '#007aff',
              color: 'white',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',
              ':hover': {
                background: '#0051d5',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Login
          </button>
        </form>

        {authClient.oauth.providers && Object.keys(authClient.oauth.providers).length > 0 ? (
          <>
            <div
              css={{
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div css={{ flex: 1, height: '1px', background: '#d2d2d7' }} />
              <span css={{ color: '#86868b', fontSize: '0.875rem' }}>OR</span>
              <div css={{ flex: 1, height: '1px', background: '#d2d2d7' }} />
            </div>

            {Object.values(authClient.oauth.providers).map((provider) => (
              <a
                key={provider.name}
                href={provider.signInHref}
                css={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: provider.name === 'github' ? '#24292f' : '#007aff',
                  color: 'white',
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  marginBottom: '0.75rem',
                  ':hover': {
                    background: provider.name === 'github' ? '#1b1f23' : '#0051d5',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {provider.name === 'github' ? (
                  <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                ) : null}
                Continue with {provider.displayName}
              </a>
            ))}
          </>
        ) : null}

        <div
          css={{
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <a href={routes.auth.signUp.index.href()} css={{ color: '#007aff' }}>
            Don't have an account? Sign up
          </a>
          <a href={routes.auth.forgotPassword.index.href()} css={{ color: '#007aff' }}>
            Forgot password?
          </a>
        </div>
      </div>
    </Layout>
  )
}

function ForgotPasswordForm() {
  return (
    <Layout>
      <div css={{ maxWidth: '500px', margin: '4rem auto', padding: '0 20px' }}>
        <h1
          css={{
            fontSize: '2rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#1d1d1f',
            letterSpacing: '-0.02em',
          }}
        >
          Forgot Password
        </h1>
        <p css={{ fontSize: '1rem', marginBottom: '1.5rem', color: '#6e6e73' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form method="POST">
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="email"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <button
            type="submit"
            css={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#007aff',
              color: 'white',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',
              ':hover': {
                background: '#0051d5',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Send Reset Link
          </button>
        </form>
        <div css={{ marginTop: '1.5rem' }}>
          <a href={routes.auth.login.index.href()} css={{ color: '#007aff' }}>
            Back to Login
          </a>
        </div>
      </div>
    </Layout>
  )
}

function ResetPasswordForm({ token, error }: { token: string; error?: string }) {
  return (
    <Layout>
      <div css={{ maxWidth: '500px', margin: '4rem auto', padding: '0 20px' }}>
        <h1
          css={{
            fontSize: '2rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#1d1d1f',
            letterSpacing: '-0.02em',
          }}
        >
          Reset Password
        </h1>
        <p css={{ fontSize: '1rem', marginBottom: '1.5rem', color: '#6e6e73' }}>
          Enter your new password below.
        </p>
        {error ? (
          <div
            css={{
              background: '#fff3f3',
              border: '1px solid #ffcccc',
              color: '#cc0000',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        ) : null}
        <form method="POST">
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="password"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              New Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="confirmPassword"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              css={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d2d2d7',
                borderRadius: '6px',
                fontSize: '1rem',
                transition: 'border-color 0.15s ease',
                ':focus': {
                  outline: 'none',
                  borderColor: '#007aff',
                  boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                },
              }}
            />
          </div>
          <button
            type="submit"
            css={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#007aff',
              color: 'white',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',
              ':hover': {
                background: '#0051d5',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Reset Password
          </button>
        </form>
      </div>
    </Layout>
  )
}
