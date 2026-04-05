import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { authAccounts, db, passwordResetTokens } from './data/setup.ts'
import {
  persistAuthAccountTokens,
  readStoredAuthAccountTokens,
} from './utils/auth-account-tokens.ts'
import { createExternalProviderRegistry } from './utils/external-auth.ts'
import {
  assertContains,
  createTestApp,
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
    assertContains(html, 'Bluesky handle or DID')
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

      let storedTokens = await readStoredAuthAccountTokens(db, authAccount.id)
      assert.ok(storedTokens)
      assert.equal(storedTokens.accessToken, 'test-google-access-token')
      assert.equal(storedTokens.refreshToken, undefined)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('refreshes stored Google tokens on demand when they expire', async () => {
    let originalFetch = globalThis.fetch
    let refreshRequests = 0
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
        let body = new URLSearchParams(await request.text())

        if (body.get('grant_type') === 'authorization_code') {
          return Response.json({
            access_token: 'google-access-token-1',
            refresh_token: 'google-refresh-token-1',
            token_type: 'Bearer',
            expires_in: 3600,
            id_token: 'google-id-token-1',
          })
        }

        refreshRequests += 1
        assert.equal(body.get('grant_type'), 'refresh_token')
        assert.equal(body.get('refresh_token'), 'google-refresh-token-1')

        return Response.json({
          access_token: 'google-access-token-2',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid email profile',
        })
      }

      if (url.href === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return Response.json({
          sub: 'google-user-refresh',
          email: 'google-refresh@example.com',
          email_verified: true,
          name: 'Google Refresh User',
          picture: 'https://example.com/google-refresh-user.png',
        })
      }

      return originalFetch(input, init)
    }

    try {
      let loginResponse = await router.fetch('https://social-auth.test/auth/google/login')
      let state = new URL(loginResponse.headers.get('Location') ?? '').searchParams.get('state')
      assert.ok(state)

      let loginSessionCookie = getSessionCookie(loginResponse)
      assert.ok(loginSessionCookie)

      let callbackResponse = await router.fetch(
        requestWithSession(
          `https://social-auth.test/auth/google/callback?code=test-google-code&state=${encodeURIComponent(state)}`,
          loginSessionCookie,
        ),
      )
      let callbackSessionCookie = getSessionCookie(callbackResponse)
      assert.ok(callbackSessionCookie)

      let authAccount = await db.findOne(authAccounts, {
        where: {
          provider: 'google',
          provider_account_id: 'google-user-refresh',
        },
      })
      assert.ok(authAccount)

      await persistAuthAccountTokens(db, authAccount.id, {
        accessToken: 'google-access-token-expired',
        refreshToken: 'google-refresh-token-1',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() - 5 * 60_000),
        scope: ['openid', 'email', 'profile'],
      })

      let accountResponse = await router.fetch(
        requestWithSession('https://social-auth.test/account', callbackSessionCookie),
      )
      let html = await accountResponse.text()

      assert.equal(accountResponse.status, 200)
      assertContains(html, 'Google Refresh User')
      assertContains(html, '"refreshed": true')
      assert.equal(refreshRequests, 1)

      let refreshedTokens = await readStoredAuthAccountTokens(db, authAccount.id)
      assert.ok(refreshedTokens)
      assert.equal(refreshedTokens.accessToken, 'google-access-token-2')
      assert.equal(refreshedTokens.refreshToken, 'google-refresh-token-1')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('completes Atmosphere login from a Bluesky handle and persists the linked account', async () => {
    let originalFetch = globalThis.fetch
    let { router, sessionCookie, sessionStorage } = await createTestApp({
      externalProviderRegistry: createExternalProviderRegistry({
        origin: 'https://social-auth.test',
      }),
    })

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let request = input instanceof Request ? input : new Request(input, init)
      let url = new URL(request.url)

      if (url.origin === 'https://1.1.1.1' && url.pathname === '/dns-query') {
        return Response.json({
          Answer: [
            {
              type: 16,
              data: '"did=did:plc:demoalice"',
            },
          ],
        })
      }

      if (url.href === 'https://demoalice.example.com/.well-known/atproto-did') {
        return new Response('Not found', { status: 404 })
      }

      if (url.href === 'https://plc.directory/did%3Aplc%3Ademoalice') {
        return Response.json({
          id: 'did:plc:demoalice',
          alsoKnownAs: ['at://demoalice.example.com'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.demo.example.com',
            },
          ],
        })
      }

      if (url.href === 'https://pds.demo.example.com/.well-known/oauth-protected-resource') {
        return Response.json({
          authorization_servers: ['https://auth.demo.example.com'],
        })
      }

      if (url.href === 'https://auth.demo.example.com/.well-known/oauth-authorization-server') {
        return Response.json({
          issuer: 'https://auth.demo.example.com',
          authorization_endpoint: 'https://auth.demo.example.com/oauth/authorize',
          token_endpoint: 'https://auth.demo.example.com/oauth/token',
          pushed_authorization_request_endpoint: 'https://auth.demo.example.com/oauth/par',
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
          token_endpoint_auth_signing_alg_values_supported: ['ES256'],
          scopes_supported: ['atproto'],
          authorization_response_iss_parameter_supported: true,
          require_pushed_authorization_requests: true,
          client_id_metadata_document_supported: true,
          dpop_signing_alg_values_supported: ['ES256'],
        })
      }

      if (url.href === 'https://auth.demo.example.com/oauth/par') {
        let body = new URLSearchParams(await request.text())

        if (
          request.headers.get('DPoP-Nonce') == null &&
          decodeJwt(request.headers.get('DPoP')).payload.nonce == null
        ) {
          return Response.json(
            { error: 'use_dpop_nonce' },
            {
              status: 400,
              headers: {
                'DPoP-Nonce': 'atmosphere-par-nonce',
              },
            },
          )
        }

        assert.equal(
          body.get('client_id'),
          'http://localhost/?redirect_uri=http%3A%2F%2F127.0.0.1%3A44100%2Fauth%2Fatmosphere%2Fcallback&scope=atproto',
        )
        assert.equal(body.get('login_hint'), 'demoalice.example.com')
        assert.equal(body.get('scope'), 'atproto')

        return Response.json(
          {
            request_uri: 'urn:ietf:params:oauth:request_uri:atmosphere-demo',
          },
          {
            headers: {
              'DPoP-Nonce': 'atmosphere-token-nonce',
            },
          },
        )
      }

      if (url.href === 'https://auth.demo.example.com/oauth/token') {
        let body = new URLSearchParams(await request.text())
        let dpop = decodeJwt(request.headers.get('DPoP'))

        assert.equal(body.get('grant_type'), 'authorization_code')
        assert.equal(body.get('code'), 'test-atmosphere-code')
        assert.equal(body.get('redirect_uri'), 'http://127.0.0.1:44100/auth/atmosphere/callback')
        assert.equal(dpop.payload.nonce, 'atmosphere-token-nonce')

        return Response.json({
          access_token: 'test-atmosphere-access-token',
          refresh_token: 'test-atmosphere-refresh-token',
          token_type: 'DPoP',
          scope: 'atproto',
          sub: 'did:plc:demoalice',
        })
      }

      return originalFetch(input, init)
    }

    try {
      let loginResponse = await router.fetch(
        'https://social-auth.test/auth/atmosphere/login?handleOrDid=demoalice.example.com&returnTo=/account',
      )

      assert.equal(loginResponse.status, 302)

      let authorizeUrl = new URL(loginResponse.headers.get('Location') ?? '')
      assert.equal(authorizeUrl.origin, 'https://auth.demo.example.com')
      assert.equal(authorizeUrl.pathname, '/oauth/authorize')

      let state = authorizeUrl.searchParams.get('request_uri')
      assert.equal(state, 'urn:ietf:params:oauth:request_uri:atmosphere-demo')

      let loginSessionCookie = getSessionCookie(loginResponse)
      assert.ok(loginSessionCookie)
      let cookieHeader = requestWithSession(
        'https://social-auth.test/',
        loginSessionCookie,
      ).headers.get('Cookie')
      let sessionId = await sessionCookie.parse(cookieHeader)
      let transactionSession = await sessionStorage.read(sessionId)
      let transaction = transactionSession.get('__auth') as { state: string }
      assert.ok(transaction)

      let callbackResponse = await router.fetch(
        requestWithSession(
          'http://127.0.0.1:44100/auth/atmosphere/callback?code=test-atmosphere-code&state=' +
            encodeURIComponent(transaction.state) +
            '&iss=' +
            encodeURIComponent('https://auth.demo.example.com'),
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
      assertContains(html, 'demoalice.example.com')
      assertContains(html, 'Provider: Atmosphere')

      let authAccount = await db.findOne(authAccounts, {
        where: {
          provider: 'atmosphere',
          provider_account_id: 'did:plc:demoalice',
        },
      })

      assert.ok(authAccount)
      assert.equal(authAccount.username, 'demoalice.example.com')
      assert.equal(authAccount.display_name, 'demoalice.example.com')
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

function decodeJwt(value: string | null): { payload: Record<string, string | undefined> } {
  assert.ok(value)
  let [, payload] = value.split('.')
  return {
    payload: JSON.parse(decodeBase64Url(payload)) as Record<string, string | undefined>,
  }
}

function decodeBase64Url(value: string): string {
  let padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding
  let binary = atob(base64)
  let bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
