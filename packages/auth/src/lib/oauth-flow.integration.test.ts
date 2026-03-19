import * as assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { auth, Auth, requireAuth, createSessionAuthScheme } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createExternalAuthCallbackRequestHandler } from './external-callback.ts'
import { createExternalAuthLoginRequestHandler } from './external-login.ts'
import { createOIDCAuthProvider } from './providers/oidc.ts'
import { createRequest, startFakeOAuthServer, type FakeOAuthServer } from './test-utils.ts'

describe('OAuth flow integration', () => {
  let server: FakeOAuthServer

  beforeEach(async () => {
    server = await startFakeOAuthServer({
      sub: 'oauth-user-1',
      email: 'oauth@example.com',
      name: 'OAuth User',
    })
  })

  afterEach(async () => {
    await server.close()
  })

  it('completes the full browser OIDC flow against a local fake provider', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let users = new Map([
      ['oauth-user-1', { id: 'oauth-user-1', email: 'oauth@example.com' }],
    ])
    let provider = createOIDCAuthProvider({
      name: 'fake',
      issuer: server.origin,
      clientId: 'fake-client-id',
      clientSecret: 'fake-client-secret',
      redirectUri: 'https://app.example.com/auth/fake/callback',
    })
    let router = createRouter({
      middleware: [
        sessionMiddleware(cookie, storage),
        auth({
          schemes: [
            createSessionAuthScheme({
              read(session) {
                return session.get('auth') as { userId: string } | null
              },
              verify(value) {
                return users.get(value.userId) ?? null
              },
              invalidate(session) {
                session.unset('auth')
              },
            }),
          ],
        }),
      ],
    })

    router.get('/login/fake', createExternalAuthLoginRequestHandler(provider))
    router.get(
      '/auth/fake/callback',
      createExternalAuthCallbackRequestHandler(provider, {
        writeSession(session, result) {
          session.set('auth', { userId: result.profile.sub })
        },
      }),
    )
    router.get('/dashboard', {
      middleware: [requireAuth()],
      action({ get }) {
        return Response.json(get(Auth))
      },
    })

    let loginResponse = await router.fetch(
      'https://app.example.com/login/fake?returnTo=/dashboard',
    )
    let authorizeURL = new URL(loginResponse.headers.get('Location')!)

    assert.equal(authorizeURL.origin, server.origin)
    assert.equal(authorizeURL.pathname, '/authorize')
    assert.equal(authorizeURL.searchParams.get('response_type'), 'code')
    assert.equal(authorizeURL.searchParams.get('scope'), 'openid profile email')

    let providerAuthorizeResponse = await fetch(authorizeURL, {
      redirect: 'manual',
    })
    let callbackURL = providerAuthorizeResponse.headers.get('Location')

    assert.equal(providerAuthorizeResponse.status, 302)
    assert.equal(typeof callbackURL, 'string')

    let callbackResponse = await router.fetch(createRequest(callbackURL!, loginResponse))

    assert.equal(callbackResponse.status, 302)
    assert.equal(callbackResponse.headers.get('Location'), '/dashboard')

    let dashboardResponse = await router.fetch(
      createRequest('https://app.example.com/dashboard', callbackResponse),
    )

    assert.deepEqual(await dashboardResponse.json(), {
      ok: true,
      identity: { id: 'oauth-user-1', email: 'oauth@example.com' },
      method: 'session',
    })
  })
})
