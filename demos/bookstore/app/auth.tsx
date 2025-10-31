import type { RouteHandlers } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '../routes.ts'
import { login, logout } from './utils/session.ts'
import {
  authenticateUser,
  createUser,
  getUserByEmail,
  createPasswordResetToken,
  resetPassword,
} from './models/users.ts'
import { Document } from './layout.tsx'
import { loadAuth } from './middleware/auth.ts'
import { render } from './utils/render.ts'

export default {
  use: [loadAuth],
  handlers: {
    login: {
      index() {
        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Login</h1>
              <form method="POST" action={routes.auth.login.action.href()}>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required autoComplete="email" />
                </div>

                <div class="form-group">
                  <label for="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Login
                </button>
              </form>

              <p style="margin-top: 1.5rem;">
                Don't have an account? <a href={routes.auth.register.index.href()}>Register here</a>
              </p>
              <p>
                <a href={routes.auth.forgotPassword.index.href()}>Forgot password?</a>
              </p>

              <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                <p style="font-size: 0.9rem;">
                  <strong>Demo Accounts:</strong>
                </p>
                <p style="font-size: 0.9rem;">Admin: admin@bookstore.com / admin123</p>
                <p style="font-size: 0.9rem;">Customer: customer@example.com / password123</p>
              </div>
            </div>
          </Document>,
        )
      },

      async action({ session, formData }) {
        let email = formData.get('email')?.toString() ?? ''
        let password = formData.get('password')?.toString() ?? ''
        let user = authenticateUser(email, password)

        if (!user) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <div class="alert alert-error">Invalid email or password. Please try again.</div>
                <p>
                  <a href={routes.auth.login.index.href()} class="btn">
                    Back to Login
                  </a>
                </p>
              </div>
            </Document>,
            { status: 401 },
          )
        }

        login(session, user)

        return redirect(routes.account.index.href())
      },
    },

    register: {
      index() {
        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Register</h1>
              <form method="POST" action={routes.auth.register.action.href()}>
                <div class="form-group">
                  <label for="name">Name</label>
                  <input type="text" id="name" name="name" required autoComplete="name" />
                </div>

                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required autoComplete="email" />
                </div>

                <div class="form-group">
                  <label for="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Register
                </button>
              </form>

              <p style="margin-top: 1.5rem;">
                Already have an account? <a href={routes.auth.login.index.href()}>Login here</a>
              </p>
            </div>
          </Document>,
        )
      },

      async action({ session, formData }) {
        let name = formData.get('name')?.toString() ?? ''
        let email = formData.get('email')?.toString() ?? ''
        let password = formData.get('password')?.toString() ?? ''

        // Check if user already exists
        if (getUserByEmail(email)) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <div class="alert alert-error">An account with this email already exists.</div>
                <p>
                  <a href={routes.auth.register.index.href()} class="btn">
                    Back to Register
                  </a>
                  <a
                    href={routes.auth.login.index.href()}
                    class="btn btn-secondary"
                    style="margin-left: 0.5rem;"
                  >
                    Login
                  </a>
                </p>
              </div>
            </Document>,
            { status: 400 },
          )
        }

        let user = createUser(email, password, name)

        login(session, user)

        return redirect(routes.account.index.href())
      },
    },

    logout({ session }) {
      logout(session)

      return redirect(routes.home.href())
    },

    forgotPassword: {
      index() {
        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Forgot Password</h1>
              <p>Enter your email address and we'll send you a link to reset your password.</p>

              <form method="POST" action={routes.auth.forgotPassword.action.href()}>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required autoComplete="email" />
                </div>

                <button type="submit" class="btn">
                  Send Reset Link
                </button>
              </form>

              <p style="margin-top: 1.5rem;">
                <a href={routes.auth.login.index.href()}>Back to Login</a>
              </p>
            </div>
          </Document>,
        )
      },

      async action({ formData }) {
        let email = formData.get('email')?.toString() ?? ''
        let token = createPasswordResetToken(email)

        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <div class="alert alert-success">Password reset link sent! Check your email.</div>

              {token ? (
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                  <p style="font-size: 0.9rem;">
                    <strong>Demo Mode:</strong> Click the link below to reset your password
                  </p>
                  <p style="margin-top: 0.5rem;">
                    <a
                      href={routes.auth.resetPassword.index.href({ token })}
                      class="btn btn-secondary"
                    >
                      Reset Password
                    </a>
                  </p>
                </div>
              ) : null}

              <p style="margin-top: 1.5rem;">
                <a href={routes.auth.login.index.href()} class="btn">
                  Back to Login
                </a>
              </p>
            </div>
          </Document>,
        )
      },
    },

    resetPassword: {
      index({ params }) {
        let token = params.token

        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <h1>Reset Password</h1>
              <p>Enter your new password below.</p>

              <form method="POST" action={routes.auth.resetPassword.action.href({ token })}>
                <div class="form-group">
                  <label for="password">New Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div class="form-group">
                  <label for="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" class="btn">
                  Reset Password
                </button>
              </form>
            </div>
          </Document>,
        )
      },

      async action({ formData, params }) {
        let password = formData.get('password')?.toString() ?? ''
        let confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

        if (password !== confirmPassword) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <div class="alert alert-error">Passwords do not match.</div>
                <p>
                  <a
                    href={routes.auth.resetPassword.index.href({ token: params.token })}
                    class="btn"
                  >
                    Try Again
                  </a>
                </p>
              </div>
            </Document>,
            { status: 400 },
          )
        }

        let success = resetPassword(params.token, password)

        if (!success) {
          return render(
            <Document>
              <div class="card" style="max-width: 500px; margin: 2rem auto;">
                <div class="alert alert-error">Invalid or expired reset token.</div>
                <p>
                  <a href={routes.auth.forgotPassword.index.href()} class="btn">
                    Request New Link
                  </a>
                </p>
              </div>
            </Document>,
            { status: 400 },
          )
        }

        return render(
          <Document>
            <div class="card" style="max-width: 500px; margin: 2rem auto;">
              <div class="alert alert-success">
                Password reset successfully! You can now login with your new password.
              </div>
              <p>
                <a href={routes.auth.login.index.href()} class="btn">
                  Login
                </a>
              </p>
            </div>
          </Document>,
        )
      },
    },
  },
} satisfies RouteHandlers<typeof routes.auth>
