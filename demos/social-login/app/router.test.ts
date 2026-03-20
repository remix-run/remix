import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { db, passwordResetTokens } from './data/setup.ts'
import { createTestRouter, assertContains, getSessionCookie, requestWithSession } from '../test/helpers.ts'

describe('social-login router', () => {
  it('renders the login page at the home route', async () => {
    let router = await createTestRouter()
    let response = await router.fetch('https://social-login.test/')

    assert.equal(response.status, 200)
    let html = await response.text()

    assertContains(html, 'Welcome Back')
    assertContains(html, 'Sign in to your account')
  })

  it('renders disabled social buttons when provider env vars are missing', async () => {
    let router = await createTestRouter()
    let response = await router.fetch('https://social-login.test/')
    let html = await response.text()

    assertContains(html, 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
    assertContains(html, 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET')
    assertContains(html, 'X_CLIENT_ID and X_CLIENT_SECRET')
  })

  it('logs in with credentials and shows the protected account page', async () => {
    let router = await createTestRouter()
    let loginResponse = await router.fetch('https://social-login.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'password123' }),
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/account')

    let sessionCookie = getSessionCookie(loginResponse)
    assert.ok(sessionCookie)

    let accountResponse = await router.fetch(
      requestWithSession('https://social-login.test/account', sessionCookie),
    )
    let html = await accountResponse.text()

    assert.equal(accountResponse.status, 200)
    assertContains(html, 'Signed In')
    assertContains(html, 'Demo User')
    assertContains(html, 'Credentials')
  })

  it('shows an error after invalid credentials', async () => {
    let router = await createTestRouter()
    let loginResponse = await router.fetch('https://social-login.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'wrong-password' }),
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/')

    let sessionCookie = getSessionCookie(loginResponse)
    assert.ok(sessionCookie)

    let homeResponse = await router.fetch(
      requestWithSession('https://social-login.test/', sessionCookie),
    )
    let html = await homeResponse.text()

    assertContains(html, 'Invalid email or password. Please try again.')
  })

  it('creates a new user during signup and signs them in', async () => {
    let router = await createTestRouter()
    let response = await router.fetch('https://social-login.test/auth/signup', {
      method: 'POST',
      body: new URLSearchParams({
        name: 'New Demo User',
        email: 'new-user@example.com',
        password: 'password123',
      }),
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/account')

    let sessionCookie = getSessionCookie(response)
    assert.ok(sessionCookie)

    let accountResponse = await router.fetch(
      requestWithSession('https://social-login.test/account', sessionCookie),
    )
    let html = await accountResponse.text()

    assertContains(html, 'New Demo User')
    assertContains(html, 'new-user@example.com')
  })

  it('creates a reset token and allows resetting the password', async () => {
    let router = await createTestRouter()
    let forgotResponse = await router.fetch('https://social-login.test/auth/forgot-password', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com' }),
    })
    let forgotHtml = await forgotResponse.text()

    assert.equal(forgotResponse.status, 200)
    assertContains(forgotHtml, 'Password reset instructions are ready.')

    let token = await db.findOne(passwordResetTokens, { where: { user_id: 2 } })
    assert.ok(token)

    let resetResponse = await router.fetch(
      `https://social-login.test/auth/reset-password/${token.token}`,
      {
        method: 'POST',
        body: new URLSearchParams({
          password: 'newpassword123',
          confirmPassword: 'newpassword123',
        }),
      },
    )
    let resetHtml = await resetResponse.text()

    assert.equal(resetResponse.status, 200)
    assertContains(resetHtml, 'Password Updated')

    let loginResponse = await router.fetch('https://social-login.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'newpassword123' }),
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/account')
  })

  it('logs out and redirects subsequent protected requests back to home', async () => {
    let router = await createTestRouter()
    let loginResponse = await router.fetch('https://social-login.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'password123' }),
    })

    let sessionCookie = getSessionCookie(loginResponse)
    assert.ok(sessionCookie)

    let logoutResponse = await router.fetch(
      requestWithSession('https://social-login.test/auth/logout', sessionCookie, {
        method: 'POST',
      }),
    )

    assert.equal(logoutResponse.status, 302)
    assert.equal(logoutResponse.headers.get('Location'), '/')

    let accountResponse = await router.fetch(
      requestWithSession('https://social-login.test/account', sessionCookie),
    )

    assert.equal(accountResponse.status, 302)
    assert.equal(accountResponse.headers.get('Location'), '/')
  })
})
