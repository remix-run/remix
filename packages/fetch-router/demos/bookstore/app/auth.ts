import { createHandlers, html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { userKey } from './storage-keys.ts'

export const authHandlers = createHandlers(routes.auth, {
  login: {
    show() {
      return html(`
        <html>
          <head><title>Login - Bookstore</title></head>
          <body>
            <h1>🔐 Login</h1>
            <form method="POST">
              <p><label>Email: <input name="email" type="email" required></label></p>
              <p><label>Password: <input name="password" type="password" required></label></p>
              <p><button type="submit">Login</button></p>
            </form>
            <p><a href="${routes.auth.signup.show.href()}">Don't have an account? Sign up</a></p>
          </body>
        </html>
      `)
    },
    async action({ request, storage }) {
      let formData = await request.formData()
      let email = formData.get('email')
      let password = formData.get('password')

      // Mock authentication - accept any email/password combo
      if (email && password) {
        // Store user in session storage
        let user = {
          id: email === 'admin@bookstore.com' ? 'admin-123' : `user-${Date.now()}`,
          email: email.toString(),
          name: email.toString().split('@')[0],
        }
        storage.set(userKey, user)

        return html(`
          <html>
            <head><title>Login Success</title></head>
            <body>
              <h1>✅ Welcome back, ${user.name}!</h1>
              <p>You are now logged in as ${user.email}</p>
              <p><a href="${routes.home.href()}">Go to Homepage</a></p>
              <p><a href="${routes.blog.index.href()}">Browse Blog</a></p>
              ${user.id.startsWith('admin') ? `<p><a href="${routes.admin.dashboard.href()}">Admin Dashboard</a></p>` : ''}
            </body>
          </html>
        `)
      } else {
        return html(
          `
          <html>
            <head><title>Login Failed</title></head>
            <body>
              <h1>❌ Login Failed</h1>
              <p>Please provide both email and password.</p>
              <p><a href="${routes.auth.login.show.href()}">Try Again</a></p>
            </body>
          </html>
        `,
          { status: 401 },
        )
      }
    },
  },
  signup: {
    show() {
      return html(`
        <html>
          <head><title>Sign Up - Bookstore</title></head>
          <body>
            <h1>📝 Create Account</h1>
            <form method="POST">
              <p><label>Name: <input name="name" required></label></p>
              <p><label>Email: <input name="email" type="email" required></label></p>
              <p><label>Password: <input name="password" type="password" required></label></p>
              <p><button type="submit">Create Account</button></p>
            </form>
            <p><a href="${routes.auth.login.show.href()}">Already have an account? Login</a></p>
          </body>
        </html>
      `)
    },
    async action({ request, storage }) {
      let formData = await request.formData()
      let name = formData.get('name')
      let email = formData.get('email')
      let password = formData.get('password')

      if (name && email && password) {
        // Create new user account
        let user = {
          id: `user-${Date.now()}`,
          email: email.toString(),
          name: name.toString(),
        }
        storage.set(userKey, user)

        return html(`
          <html>
            <head><title>Account Created</title></head>
            <body>
              <h1>🎉 Account Created!</h1>
              <p>Welcome ${user.name}! Your account has been created.</p>
              <p><a href="${routes.home.href()}">Go to Homepage</a></p>
              <p><a href="${routes.blog.index.href()}">Browse Blog</a></p>
            </body>
          </html>
        `)
      } else {
        return html(
          `
          <html>
            <head><title>Signup Failed</title></head>
            <body>
              <h1>❌ Signup Failed</h1>
              <p>Please fill in all fields.</p>
              <p><a href="${routes.auth.signup.show.href()}">Try Again</a></p>
            </body>
          </html>
        `,
          { status: 400 },
        )
      }
    },
  },
  async logout({ storage }) {
    // Clear user from storage (set to null/default)
    storage.set(userKey, null)

    return html(`
      <html>
        <head><title>Logged Out</title></head>
        <body>
          <h1>👋 Logged Out</h1>
          <p>You have been successfully logged out.</p>
          <p><a href="${routes.home.href()}">Go to Homepage</a></p>
          <p><a href="${routes.auth.login.show.href()}">Login Again</a></p>
        </body>
      </html>
    `)
  },
})
