import { css } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Document } from '../../../ui/document.tsx'
import { authCardStyle } from '../schemas.ts'

export function RegisterPage() {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
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

        <p mix={css({ marginTop: '1.5rem' })}>
          Already have an account? <a href={routes.auth.login.index.href()}>Login here</a>
        </p>
      </div>
    </Document>
  )
}

export function ExistingAccountPage() {
  return () => (
    <Document>
      <div class="card" mix={authCardStyle}>
        <div class="alert alert-error">An account with this email already exists.</div>
        <p>
          <a href={routes.auth.register.index.href()} class="btn">
            Back to Register
          </a>
          <a
            href={routes.auth.login.index.href()}
            class="btn btn-secondary"
            mix={css({ marginLeft: '0.5rem' })}
          >
            Login
          </a>
        </p>
      </div>
    </Document>
  )
}
