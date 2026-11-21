import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from './db.ts'
import { authAccounts, passwordResetTokens, users } from './data/schema.ts'
import { readLatestOutboxEmail } from './utils/email-outbox.ts'
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
      let loginResponse = await router.fetch(
        'https://social-auth.test/auth/google/login?returnTo=/account',
      )

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

  it('signs in with a magic link after confirming it on the verification page', async () => {
    let router = await createTestRouter()
    let sendResponse = await router.fetch(
      'https://social-auth.test/auth/magic-link?returnTo=/account',
      {
        method: 'POST',
        body: new URLSearchParams({ email: 'User@Example.com' }),
      },
    )
    let sentHtml = await sendResponse.text()

    assert.equal(sendResponse.status, 200)
    assertContains(sentHtml, 'We sent a sign-in link to user@example.com.')

    let link = new URL(readLatestOutboxEmail('user@example.com')?.link ?? '')
    let verifyUrl = `https://social-auth.test${link.pathname}${link.search}`

    let confirmResponse = await router.fetch(verifyUrl)
    assert.equal(confirmResponse.status, 200)
    assert.equal(confirmResponse.headers.get('Referrer-Policy'), 'no-referrer')
    assertContains(await confirmResponse.text(), 'Finish Signing In')

    let verifyResponse = await router.fetch(verifyUrl, { method: 'POST' })
    assert.equal(verifyResponse.status, 302)
    assert.equal(verifyResponse.headers.get('Location'), '/account')

    let sessionCookie = getSessionCookie(verifyResponse)
    assert.ok(sessionCookie)

    let accountResponse = await router.fetch(
      requestWithSession('https://social-auth.test/account', sessionCookie),
    )
    let accountHtml = await accountResponse.text()

    assertContains(accountHtml, 'Demo User')
    assertContains(accountHtml, 'Provider: Magic Link')

    let replayResponse = await router.fetch(verifyUrl, { method: 'POST' })
    assert.equal(replayResponse.status, 400)
    assertContains(await replayResponse.text(), 'Link Not Valid')
  })

  it('asks people to wait before sending another magic link', async () => {
    let router = await createTestRouter()
    let request = () =>
      router.fetch('https://social-auth.test/auth/magic-link', {
        method: 'POST',
        body: new URLSearchParams({ email: 'user@example.com' }),
      })

    await request()
    let resendResponse = await request()

    assert.equal(resendResponse.status, 200)
    assertContains(await resendResponse.text(), 'We already sent a link to this address.')
  })

  it('creates an account the first time a new address signs in with a code', async () => {
    let router = await createTestRouter()
    let sendResponse = await router.fetch('https://social-auth.test/auth/email-code', {
      method: 'POST',
      body: new URLSearchParams({ email: 'new-person@example.com' }),
    })

    assert.equal(sendResponse.status, 302)
    assert.equal(sendResponse.headers.get('Location'), '/auth/email-code/verify')

    let sessionCookie = getSessionCookie(sendResponse)
    assert.ok(sessionCookie)

    let code = readLatestOutboxEmail('new-person@example.com')?.code ?? ''
    let wrongCode = code.replace(/^\d/, (digit) => String((Number(digit) + 1) % 10))

    let wrongResponse = await router.fetch(
      requestWithSession('https://social-auth.test/auth/email-code/verify', sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ code: wrongCode }),
      }),
    )
    assert.equal(wrongResponse.status, 400)
    assertContains(await wrongResponse.text(), 'That code is incorrect. 2 attempts left.')

    let verifyResponse = await router.fetch(
      requestWithSession('https://social-auth.test/auth/email-code/verify', sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ code }),
      }),
    )
    assert.equal(verifyResponse.status, 302)
    assert.equal(verifyResponse.headers.get('Location'), '/account')

    let authenticatedCookie = getSessionCookie(verifyResponse)
    assert.ok(authenticatedCookie)
    assert.notEqual(authenticatedCookie, sessionCookie)

    let accountResponse = await router.fetch(
      requestWithSession('https://social-auth.test/account', authenticatedCookie),
    )
    let accountHtml = await accountResponse.text()

    assertContains(accountHtml, 'new-person@example.com')
    assertContains(accountHtml, 'Provider: Email Code')
    assert.ok(await db.findOne(users, { where: { email: 'new-person@example.com' } }))
  })

  it('stops an unverified signup password from working once the owner signs in by email', async () => {
    let router = await createTestRouter()

    await router.fetch('https://social-auth.test/auth/signup', {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Someone Else',
        email: 'owner@example.com',
        password: 'attacker-password',
      }),
    })

    let sendResponse = await router.fetch('https://social-auth.test/auth/email-code', {
      method: 'POST',
      body: new URLSearchParams({ email: 'owner@example.com' }),
    })
    let sessionCookie = getSessionCookie(sendResponse)
    assert.ok(sessionCookie)

    let verifyResponse = await router.fetch(
      requestWithSession('https://social-auth.test/auth/email-code/verify', sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ code: readLatestOutboxEmail('owner@example.com')?.code ?? '' }),
      }),
    )
    assert.equal(verifyResponse.status, 302)

    let passwordResponse = await router.fetch('https://social-auth.test/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email: 'owner@example.com', password: 'attacker-password' }),
    })
    assert.equal(passwordResponse.headers.get('Location'), '/')

    let owner = await db.findOne(users, { where: { email: 'owner@example.com' } })
    assert.ok(owner?.email_verified_at)
    assert.equal(owner?.password_hash, null)
  })

  it('ignores returnTo values that browsers would treat as another origin', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(
      `https://social-auth.test/auth/login?returnTo=${encodeURIComponent('/\\evil.example')}`,
      {
        method: 'POST',
        body: new URLSearchParams({ email: 'user@example.com', password: 'password123' }),
      },
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/account')
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
