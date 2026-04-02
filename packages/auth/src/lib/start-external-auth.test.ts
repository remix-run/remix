import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { createGoogleAuthProvider } from './providers/google.ts'
import { startExternalAuth } from './start-external-auth.ts'
import { createRequest } from './test-utils.ts'

describe('startExternalAuth()', () => {
  it('redirects to the provider authorization URL and stores a transaction', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createGoogleAuthProvider({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'https://app.example.com/auth/google/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/google', (context) =>
      startExternalAuth(provider, context, {
        returnTo: context.url.searchParams.get('returnTo'),
      }),
    )
    router.get('/inspect', ({ get }) => Response.json(get(Session).get('__auth')))

    let response = await router.fetch('https://app.example.com/login/google?returnTo=/dashboard')
    let location = new URL(response.headers.get('Location')!)
    let inspectResponse = await router.fetch(
      createRequest('https://app.example.com/inspect', response),
    )
    let transaction = await inspectResponse.json()

    assert.equal(response.status, 302)
    assert.equal(response.headers.getSetCookie().length, 1)
    assert.equal(location.origin, 'https://accounts.google.com')
    assert.equal(location.pathname, '/o/oauth2/v2/auth')
    assert.equal(location.searchParams.get('client_id'), 'google-client-id')
    assert.equal(
      location.searchParams.get('redirect_uri'),
      'https://app.example.com/auth/google/callback',
    )
    assert.equal(location.searchParams.get('response_type'), 'code')
    assert.equal(location.searchParams.get('scope'), 'openid email profile')
    assert.equal(typeof location.searchParams.get('state'), 'string')
    assert.equal(typeof location.searchParams.get('code_challenge'), 'string')
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(transaction.provider, 'google')
    assert.equal(transaction.state, location.searchParams.get('state'))
    assert.equal(typeof transaction.codeVerifier, 'string')
    assert.equal(transaction.returnTo, '/dashboard')
  })

  it('drops unsafe returnTo values before persisting the transaction', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = createGoogleAuthProvider({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'https://app.example.com/auth/google/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/login/google', (context) =>
      startExternalAuth(provider, context, {
        returnTo: context.url.searchParams.get('returnTo'),
      }),
    )
    router.get('/inspect', ({ get }) => Response.json(get(Session).get('__auth')))

    let response = await router.fetch(
      'https://app.example.com/login/google?returnTo=https://evil.example.com',
    )
    let inspectResponse = await router.fetch(
      createRequest('https://app.example.com/inspect', response),
    )
    let transaction = await inspectResponse.json()

    assert.equal(response.status, 302)
    assert.equal(transaction.provider, 'google')
    assert.equal(typeof transaction.state, 'string')
    assert.equal(typeof transaction.codeVerifier, 'string')
    assert.equal(transaction.returnTo, undefined)
  })
})
