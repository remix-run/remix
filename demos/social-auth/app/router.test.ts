import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { authAccounts, db, passwordResetTokens } from './data/setup.ts'
import { createExternalProviderRegistry } from './utils/external-auth.ts'
import {
  assertContains,
  createTestRouter,
  getSessionCookie,
  requestWithSession,
} from '../test/helpers.ts'

describe('social-auth router', () => {
  it('renders the login page at the home route', async () => {
    let router = await createTestRouter()
    let response = await router.fetch('https://social-auth.test/')

    assert.equal(response.status, 200)
    let html = await response.text()

    assertContains(html, 'Welcome Back')
    assertContains(html, 'Sign in to your account')
  })

  it('renders disabled social buttons when provider env vars are missing', async () => {
    let router = await createTestRouter()
    let response = await router.fetch('https://social-auth.test/')
    let html = await response.text()

    assertContains(html, 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
    assertContains(html, 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET')
    assertContains(html, 'X_CLIENT_ID and X_CLIENT_SECRET')
  })

  it('logs in with credentials and shows the protected account page', async () => {
    let router = await createTestRouter()
    let loginResponse = await router.fetch('https://social-auth.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'password123' }),
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/account')

    let sessionCookie = getSessionCookie(loginResponse)
    assert.ok(sessionCookie)

    let accountResponse = await router.fetch(
      requestWithSession('https://social-auth.test/account', sessionCookie),
    )
    let html = await accountResponse.text()

    assert.equal(accountResponse.status, 200)
    assertContains(html, 'Signed In')
    assertContains(html, 'Demo User')
    assertContains(html, 'Credentials')
  })

  it('shows an error after invalid credentials', async () => {
    let router = await createTestRouter()
    let loginResponse = await router.fetch('https://social-auth.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'wrong-password' }),
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/')

    let sessionCookie = getSessionCookie(loginResponse)
    assert.ok(sessionCookie)

    let homeResponse = await router.fetch(
      requestWithSession('https://social-auth.test/', sessionCookie),
    )
    let html = await homeResponse.text()

    assertContains(html, 'Invalid email or password. Please try again.')
  })

  it('completes external Google login and persists the linked account', async () => {
    let originalFetch = globalThis.fetch
    let router = await createTestRouter({
      externalProviderRegistry: createExternalProviderRegistry({
        origin: 'https://social-auth.test',
        env: {
          GOOGLE_CLIENT_ID: 'test-google-client-id',
          GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
        },
      }),
    })

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let request = input instanceof Request ? input : new Request(input, init)
      let url = new URL(request.url)

      if (url.href === 'https://oauth2.googleapis.com/token') {
        return Response.json({
          access_token: 'test-google-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: 'test-google-id-token',
        })
      }

      if (url.href === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return Response.json({
          sub: 'google-user-1',
          email: 'google-user@example.com',
          email_verified: true,
          name: 'Google Test User',
          picture: 'https://example.com/google-user.png',
        })
      }

      return originalFetch(input, init)
    }

    try {
      let loginResponse = await router.fetch('https://social-auth.test/auth/google/login?returnTo=/account')

      assert.equal(loginResponse.status, 302)

      let authorizeUrl = new URL(loginResponse.headers.get('Location') ?? '')
      assert.equal(authorizeUrl.origin, 'https://accounts.google.com')
      assert.equal(authorizeUrl.pathname, '/o/oauth2/v2/auth')

      let state = authorizeUrl.searchParams.get('state')
      assert.ok(state)

      let loginSessionCookie = getSessionCookie(loginResponse)
      assert.ok(loginSessionCookie)

      let callbackResponse = await router.fetch(
        requestWithSession(
          `https://social-auth.test/auth/google/callback?code=test-google-code&state=${encodeURIComponent(state)}`,
          loginSessionCookie,
        ),
      )

      assert.equal(callbackResponse.status, 302)
      assert.equal(callbackResponse.headers.get('Location'), '/account')

      let callbackSessionCookie = getSessionCookie(callbackResponse)
      assert.ok(callbackSessionCookie)

      let accountResponse = await router.fetch(
        requestWithSession('https://social-auth.test/account', callbackSessionCookie),
      )
      let html = await accountResponse.text()

      assert.equal(accountResponse.status, 200)
      assertContains(html, 'Signed In')
      assertContains(html, 'Google Test User')
      assertContains(html, 'google-user@example.com')
      assertContains(html, 'Provider: Google')

      let authAccount = await db.findOne(authAccounts, {
        where: {
          provider: 'google',
          provider_account_id: 'google-user-1',
        },
      })

      assert.ok(authAccount)
      assert.equal(authAccount.email, 'google-user@example.com')
      assert.equal(authAccount.display_name, 'Google Test User')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('creates a new user during signup and signs them in', async () => {
    let router = await createTestRouter()
    let response = await router.fetch('https://social-auth.test/auth/signup', {
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
      requestWithSession('https://social-auth.test/account', sessionCookie),
    )
    let html = await accountResponse.text()

    assertContains(html, 'New Demo User')
    assertContains(html, 'new-user@example.com')
  })

  it('creates a reset token and allows resetting the password', async () => {
    let router = await createTestRouter()
    let forgotResponse = await router.fetch('https://social-auth.test/auth/forgot-password', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com' }),
    })
    let forgotHtml = await forgotResponse.text()

    assert.equal(forgotResponse.status, 200)
    assertContains(forgotHtml, 'Password reset instructions are ready.')

    let token = await db.findOne(passwordResetTokens, { where: { user_id: 2 } })
    assert.ok(token)

    let resetResponse = await router.fetch(
      `https://social-auth.test/auth/reset-password/${token.token}`,
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

    let loginResponse = await router.fetch('https://social-auth.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'newpassword123' }),
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/account')
  })

  it('logs out and redirects subsequent protected requests back to home', async () => {
    let router = await createTestRouter()
    let loginResponse = await router.fetch('https://social-auth.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'user@example.com', password: 'password123' }),
    })

    let sessionCookie = getSessionCookie(loginResponse)
    assert.ok(sessionCookie)

    let logoutResponse = await router.fetch(
      requestWithSession('https://social-auth.test/auth/logout', sessionCookie, {
        method: 'POST',
      }),
    )

    assert.equal(logoutResponse.status, 302)
    assert.equal(logoutResponse.headers.get('Location'), '/')

    let accountResponse = await router.fetch(
      requestWithSession('https://social-auth.test/account', sessionCookie),
    )

    assert.equal(accountResponse.status, 302)
    assert.equal(accountResponse.headers.get('Location'), '/')
  })
})
