import type { Controller } from 'remix/fetch-router'
import { createCredentialsAuthLoginRequestHandler as authenticateWithCredentials } from 'remix/auth'
import { css } from 'remix/component'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { Document } from '../../layout.tsx'
import {
  getLoginRedirectURL,
  getPostAuthRedirect,
  passwordProvider,
} from '../../middleware/auth.ts'
import { render } from '../../utils/render.ts'
import { Session } from '../../utils/session.ts'
import { authCardStyle } from '../shared.ts'

let loginController = {
  actions: {
    index({ get, url }) {
      let session = get(Session)
      let error = session.get('error')
      let formAction = getLoginRedirectURL(url, routes.auth.login.action)

      return render(
        <Document>
          <div class="card" mix={[authCardStyle]}>
            <h1>Login</h1>

            {typeof error === 'string' ? (
              <div class="alert alert-error" mix={[css({ marginBottom: '1.5rem' })]}>
                {error}
              </div>
            ) : null}

            <form method="POST" action={formAction}>
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

            <p mix={[css({ marginTop: '1.5rem' })]}>
              Don't have an account? <a href={routes.auth.register.index.href()}>Register here</a>
            </p>
            <p>
              <a href={routes.auth.forgotPassword.index.href()}>Forgot password?</a>
            </p>

            <div
              mix={[
                css({
                  marginTop: '2rem',
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '4px',
                }),
              ]}
            >
              <p mix={[css({ fontSize: '0.9rem' })]}>
                <strong>Demo Accounts:</strong>
              </p>
              <p mix={[css({ fontSize: '0.9rem' })]}>Admin: admin@bookstore.com / admin123</p>
              <p mix={[css({ fontSize: '0.9rem' })]}>
                Customer: customer@example.com / password123
              </p>
            </div>
          </div>
        </Document>,
      )
    },

    action: authenticateWithCredentials(passwordProvider, {
      writeSession(session, user) {
        session.set('auth', { userId: user.id })
      },
      onFailure(context) {
        let session = context.get(Session)
        session.flash('error', 'Invalid email or password. Please try again.')

        return redirect(getLoginRedirectURL(context.url))
      },
      onSuccess(_user, context) {
        return redirect(getPostAuthRedirect(context.url))
      },
    }),
  },
} satisfies Controller<typeof routes.auth.login>

export default loginController
