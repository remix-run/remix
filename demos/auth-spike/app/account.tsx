import type { RouteHandlers } from '@remix-run/fetch-router'
import { createRedirectResponse } from '@remix-run/response/redirect'
import { routes } from './routes.ts'
import { requireUser, authClient } from './utils/auth.ts'
import { render } from './utils/render.tsx'
import { Layout } from './layout.tsx'
import { sendEmail } from './services/email.ts'

export default {
  handlers: {
    index({ url }) {
      let user = requireUser(url)
      if (user instanceof Response) return user

      return render(
        <Layout>
          <h1
            css={{
              fontSize: '2rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: '#1d1d1f',
              letterSpacing: '-0.02em',
            }}
          >
            Your Account
          </h1>
          <div css={{ marginBottom: '2rem' }}>
            <p
              css={{
                fontSize: '1rem',
                color: '#1d1d1f',
                marginBottom: '0.5rem',
              }}
            >
              <strong>Name:</strong> {user.name}
            </p>
            <p
              css={{
                fontSize: '1rem',
                color: '#1d1d1f',
                marginBottom: '0.5rem',
              }}
            >
              <strong>Email:</strong> {user.email}
              {user.emailVerified ? (
                <span
                  css={{
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    background: '#34c759',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  ✓ Verified
                </span>
              ) : (
                <span
                  css={{
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    background: '#ff9500',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Not Verified
                </span>
              )}
            </p>
            <p css={{ fontSize: '1rem', color: '#1d1d1f' }}>
              <strong>User ID:</strong> {user.id}
            </p>
          </div>
          <div css={{ marginTop: '2rem' }}>
            <a
              href={routes.account.changePassword.index.href()}
              css={{ color: '#007aff', textDecoration: 'none', fontWeight: 600 }}
            >
              Change Password →
            </a>
          </div>
          {!user.emailVerified && (
            <div
              css={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
              }}
            >
              <p css={{ fontSize: '0.875rem', color: '#856404', marginBottom: '0.5rem' }}>
                <strong>Email not verified.</strong> Please check your inbox for a verification
                link.
              </p>
              <form method="POST" action="/account">
                <input type="hidden" name="action" value="resend-verification" />
                <button
                  type="submit"
                  css={{
                    padding: '0.5rem 1rem',
                    background: '#007aff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'background 0.15s ease',
                    ':hover': {
                      background: '#0051d5',
                    },
                  }}
                >
                  Resend Verification Email
                </button>
              </form>
            </div>
          )}
          <div
            css={{
              marginTop: '2rem',
              paddingTop: '2rem',
              borderTop: '1px solid #d2d2d7',
            }}
          >
            <form method="POST" action={routes.account.logout.href()}>
              <button
                type="submit"
                css={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#1d1d1f',
                  border: '1px solid #d2d2d7',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  ':hover': {
                    background: '#f5f5f7',
                  },
                }}
              >
                Sign Out
              </button>
            </form>
          </div>
          <div css={{ marginTop: '1.5rem' }}>
            <a href={routes.home.href()} css={{ color: '#007aff' }}>
              ← Back to Home
            </a>
          </div>
        </Layout>,
      )
    },

    async action({ request, url }: { request: Request; url: URL }) {
      let user = requireUser(url)
      if (user instanceof Response) return user

      let formData = await request.formData()
      let action = formData.get('action')

      if (action === 'resend-verification') {
        let result = await authClient.emailVerification.requestVerification(user.email)

        if ('error' in result) {
          return render(
            <Layout>
              <div css={{ color: 'red' }}>Failed to send verification email.</div>
            </Layout>,
          )
        }

        return render(
          <Layout>
            <div
              css={{
                padding: '1rem',
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              <p css={{ color: '#155724', margin: 0 }}>
                Verification email sent! Please check your inbox.
              </p>
            </div>
            <a href={routes.account.index.href()} css={{ color: '#007aff' }}>
              ← Back to Account
            </a>
          </Layout>,
        )
      }

      return new Response('Invalid action', { status: 400 })
    },

    async logout({ session, url }) {
      let user = requireUser(url)
      if (user instanceof Response) return user

      await authClient.signOut(session)
      return createRedirectResponse(routes.home.href())
    },

    changePassword: {
      index({ url }) {
        let user = requireUser(url)
        if (user instanceof Response) return user

        return render(<ChangePasswordForm />)
      },

      async action({ formData, url, session }) {
        let user = requireUser(url)
        if (user instanceof Response) return user

        let currentPassword = formData.get('currentPassword') as string
        let newPassword = formData.get('newPassword') as string
        let confirmPassword = formData.get('confirmPassword') as string

        if (newPassword !== confirmPassword) {
          return render(<ChangePasswordForm error="New passwords do not match" />)
        }

        // Change password
        let result = await authClient.password.change({
          session,
          currentPassword,
          newPassword,
        })

        if ('error' in result) {
          let getErrorMessage = () => {
            switch (result.error) {
              case 'invalid_password':
                return 'Current password is incorrect'
              case 'not_authenticated':
                return 'You must be logged in to change your password'
              default: {
                return 'An unknown error occurred'
              }
            }
          }
          return render(<ChangePasswordForm error={getErrorMessage()} />)
        }

        // Send confirmation email
        sendEmail({
          to: user.email,
          subject: 'Your Password Has Been Changed',
          text: `Hi there,

Your password has been successfully changed.

If you didn't make this change, please contact support immediately.`,
        })

        return render(
          <Layout>
            <h1
              css={{
                fontSize: '2rem',
                fontWeight: 600,
                marginBottom: '1rem',
                color: '#1d1d1f',
                letterSpacing: '-0.02em',
              }}
            >
              Password Changed
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
              Your password has been changed successfully!
            </div>
            <div css={{ marginTop: '1.5rem' }}>
              <a href={routes.account.index.href()} css={{ color: '#007aff' }}>
                Back to Account
              </a>
            </div>
          </Layout>,
        )
      },
    },
  },
} satisfies RouteHandlers<typeof routes.account>

function ChangePasswordForm({ error }: { error?: string }) {
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
          Change Password
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
        <form method="POST" action={routes.account.changePassword.action.href()}>
          <div css={{ marginBottom: '1.5rem' }}>
            <label
              for="currentPassword"
              css={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#1d1d1f',
              }}
            >
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
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
              for="newPassword"
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
              id="newPassword"
              name="newPassword"
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
              Confirm New Password
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
            Change Password
          </button>
        </form>
        <div css={{ marginTop: '1.5rem' }}>
          <a href={routes.account.index.href()} css={{ color: '#007aff' }}>
            ← Back to Account
          </a>
        </div>
      </div>
    </Layout>
  )
}
