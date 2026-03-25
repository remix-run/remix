import { css } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'

export interface LoginPageProps {
  formAction: string
  error?: string
}

export function LoginPage() {
  return ({ error, formAction }: LoginPageProps) => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <h1>Login</h1>

        {typeof error === 'string' ? (
          <div class="alert alert-error" mix={css({ marginBottom: '1.5rem' })}>
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

        <p mix={css({ marginTop: '1.5rem' })}>
          Don't have an account? <a href={routes.auth.register.index.href()}>Register here</a>
        </p>
        <p>
          <a href={routes.auth.forgotPassword.index.href()}>Forgot password?</a>
        </p>

        <div
          mix={css({
            marginTop: '2rem',
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '4px',
          })}
        >
          <p mix={css({ fontSize: '0.9rem' })}>
            <strong>Demo Accounts:</strong>
          </p>
          <p mix={css({ fontSize: '0.9rem' })}>Admin: admin@bookstore.com / admin123</p>
          <p mix={css({ fontSize: '0.9rem' })}>Customer: customer@example.com / password123</p>
        </div>
      </div>
    </Document>
  )
}
