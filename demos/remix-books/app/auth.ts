import { html } from '@remix-run/fetch-router'
import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, redirect } from './views/layout.ts'
import { getSession, setSessionCookie, login, logout } from './lib/session.ts'
import {
  authenticateUser,
  createUser,
  getUserByEmail,
  createPasswordResetToken,
  resetPassword,
} from './models/users.ts'

export default {
  login() {
    let content = `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <h1>Login</h1>
      <form method="POST" action="${routes.auth.loginSubmit.href()}">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required autocomplete="email">
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        
        <button type="submit" class="btn">Login</button>
      </form>
      
      <p style="margin-top: 1.5rem;">
        Don't have an account? <a href="${routes.auth.register.href()}">Register here</a>
      </p>
      <p>
        <a href="${routes.auth.forgotPassword.href()}">Forgot password?</a>
      </p>

      <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
        <p style="font-size: 0.9rem;"><strong>Demo Accounts:</strong></p>
        <p style="font-size: 0.9rem;">Admin: admin@bookstore.com / admin123</p>
        <p style="font-size: 0.9rem;">Customer: customer@example.com / password123</p>
      </div>
    </div>
  `

    return html(layout(content))
  },

  async loginSubmit({ request, url }) {
    let formData = await request.formData()
    let email = formData.get('email')?.toString() || ''
    let password = formData.get('password')?.toString() || ''

    let user = authenticateUser(email, password)

    if (!user) {
      let content = `
      <div class="card" style="max-width: 500px; margin: 2rem auto;">
        <div class="alert alert-error">
          Invalid email or password. Please try again.
        </div>
        <p>
          <a href="${routes.auth.login.href()}" class="btn">Back to Login</a>
        </p>
      </div>
    `

      return html(layout(content), { status: 401 })
    }

    let session = getSession(request)
    login(session.sessionId, user)

    let headers = new Headers()
    setSessionCookie(headers, session.sessionId)
    headers.set('Location', new URL(routes.account.index.href(), url).href)

    return new Response(null, { status: 302, headers })
  },

  register() {
    let content = `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <h1>Register</h1>
      <form method="POST" action="${routes.auth.registerSubmit.href()}">
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" required autocomplete="name">
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required autocomplete="email">
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="new-password">
        </div>
        
        <button type="submit" class="btn">Register</button>
      </form>
      
      <p style="margin-top: 1.5rem;">
        Already have an account? <a href="${routes.auth.login.href()}">Login here</a>
      </p>
    </div>
  `

    return html(layout(content))
  },

  async registerSubmit({ request, url }) {
    let formData = await request.formData()
    let name = formData.get('name')?.toString() || ''
    let email = formData.get('email')?.toString() || ''
    let password = formData.get('password')?.toString() || ''

    // Check if user already exists
    if (getUserByEmail(email)) {
      let content = `
      <div class="card" style="max-width: 500px; margin: 2rem auto;">
        <div class="alert alert-error">
          An account with this email already exists.
        </div>
        <p>
          <a href="${routes.auth.register.href()}" class="btn">Back to Register</a>
          <a href="${routes.auth.login.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Login</a>
        </p>
      </div>
    `

      return html(layout(content), { status: 400 })
    }

    let user = createUser(email, password, name)

    let session = getSession(request)
    login(session.sessionId, user)

    let headers = new Headers()
    setSessionCookie(headers, session.sessionId)
    headers.set('Location', new URL(routes.account.index.href(), url).href)

    return new Response(null, { status: 302, headers })
  },

  logout({ request, url }) {
    let session = getSession(request)
    logout(session.sessionId)

    return redirect(routes.home.href(), url)
  },

  forgotPassword() {
    let content = `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <h1>Forgot Password</h1>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      
      <form method="POST" action="${routes.auth.forgotPasswordSubmit.href()}">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required autocomplete="email">
        </div>
        
        <button type="submit" class="btn">Send Reset Link</button>
      </form>
      
      <p style="margin-top: 1.5rem;">
        <a href="${routes.auth.login.href()}">Back to Login</a>
      </p>
    </div>
  `

    return html(layout(content))
  },

  async forgotPasswordSubmit({ request }) {
    let formData = await request.formData()
    let email = formData.get('email')?.toString() || ''

    let token = createPasswordResetToken(email)

    // In production, send an email with the reset link
    // For demo, just show the link

    let content = `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <div class="alert alert-success">
        Password reset link sent! Check your email.
      </div>
      
      ${
        token
          ? `
      <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
        <p style="font-size: 0.9rem;"><strong>Demo Mode:</strong> Click the link below to reset your password</p>
        <p style="margin-top: 0.5rem;">
          <a href="${routes.auth.resetPassword.href({ token })}" class="btn btn-secondary">Reset Password</a>
        </p>
      </div>
      `
          : ''
      }
      
      <p style="margin-top: 1.5rem;">
        <a href="${routes.auth.login.href()}" class="btn">Back to Login</a>
      </p>
    </div>
  `

    return html(layout(content))
  },

  resetPassword({ params }) {
    let token = params.token

    let content = `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <h1>Reset Password</h1>
      <p>Enter your new password below.</p>
      
      <form method="POST" action="${routes.auth.resetPasswordSubmit.href({ token })}">
        <div class="form-group">
          <label for="password">New Password</label>
          <input type="password" id="password" name="password" required autocomplete="new-password">
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password">
        </div>
        
        <button type="submit" class="btn">Reset Password</button>
      </form>
    </div>
  `

    return html(layout(content))
  },

  async resetPasswordSubmit({ request, params }) {
    let formData = await request.formData()
    let password = formData.get('password')?.toString() || ''
    let confirmPassword = formData.get('confirmPassword')?.toString() || ''

    if (password !== confirmPassword) {
      let content = `
      <div class="card" style="max-width: 500px; margin: 2rem auto;">
        <div class="alert alert-error">
          Passwords do not match.
        </div>
        <p>
          <a href="${routes.auth.resetPassword.href({ token: params.token })}" class="btn">Try Again</a>
        </p>
      </div>
    `

      return html(layout(content), { status: 400 })
    }

    let success = resetPassword(params.token, password)

    if (!success) {
      let content = `
      <div class="card" style="max-width: 500px; margin: 2rem auto;">
        <div class="alert alert-error">
          Invalid or expired reset token.
        </div>
        <p>
          <a href="${routes.auth.forgotPassword.href()}" class="btn">Request New Link</a>
        </p>
      </div>
    `

      return html(layout(content), { status: 400 })
    }

    let content = `
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <div class="alert alert-success">
        Password reset successfully! You can now login with your new password.
      </div>
      <p>
        <a href="${routes.auth.login.href()}" class="btn">Login</a>
      </p>
    </div>
  `

    return html(layout(content))
  },
} satisfies RouteHandlers<typeof routes.auth>
