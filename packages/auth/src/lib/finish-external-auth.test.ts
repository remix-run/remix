import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { finishExternalAuth } from './finish-external-auth.ts'
import { createGoogleAuthProvider } from './providers/google.ts'
import { startExternalAuth } from './start-external-auth.ts'
import { createRequest, mockFetch } from './test-utils.ts'

describe('finishExternalAuth()', () => {
  it('completes a Google callback, preserves returnTo, and clears the transaction', async () => {
    let restoreFetch = mockFetch(async (input, init) => {
      let url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://oauth2.googleapis.com/token') {
        let body = new URLSearchParams(init?.body as string)
        assert.equal(body.get('code'), 'good-code')
        assert.equal(body.get('grant_type'), 'authorization_code')
        assert.equal(typeof body.get('code_verifier'), 'string')
        return Response.json({
          access_token: 'access-token',
          token_type: 'Bearer',
          scope: 'openid email profile',
        })
      }

      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return Response.json({
          sub: 'u1',
          email: 'mj@example.com',
          name: 'Michael Jackson',
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    try {
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
      router.get('/auth/google/callback', async (context) =>
        Response.json(await finishExternalAuth(provider, context)),
      )
      router.get('/inspect', ({ get }) => Response.json(get(Session).get('__auth') ?? null))

      let loginResponse = await router.fetch(
        'https://app.example.com/login/google?returnTo=/dashboard',
      )
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let callbackResponse = await router.fetch(
        createRequest(
          `https://app.example.com/auth/google/callback?code=good-code&state=${state}`,
          loginResponse,
        ),
      )
      let inspectResponse = await router.fetch(
        createRequest('https://app.example.com/inspect', callbackResponse),
      )

      assert.deepEqual(await callbackResponse.json(), {
        result: {
          provider: 'google',
          account: {
            provider: 'google',
            providerAccountId: 'u1',
          },
          profile: {
            sub: 'u1',
            email: 'mj@example.com',
            name: 'Michael Jackson',
          },
          tokens: {
            accessToken: 'access-token',
            tokenType: 'Bearer',
            scope: ['openid', 'email', 'profile'],
          },
        },
        returnTo: '/dashboard',
      })
      assert.equal(await inspectResponse.json(), null)
    } finally {
      restoreFetch()
    }
  })

  it('rethrows callback errors and clears the transaction', async () => {
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

    router.get('/login/google', (context) => startExternalAuth(provider, context))
    router.get('/auth/google/callback', async (context) => {
      try {
        return Response.json(await finishExternalAuth(provider, context))
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error ? error.message : 'unknown',
          },
          { status: 400 },
        )
      }
    })
    router.get('/inspect', ({ get }) => Response.json(get(Session).get('__auth') ?? null))

    let loginResponse = await router.fetch('https://app.example.com/login/google')
    let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
    let callbackResponse = await router.fetch(
      createRequest(
        `https://app.example.com/auth/google/callback?error=access_denied&error_description=Nope&state=${state}`,
        loginResponse,
      ),
    )
    let inspectResponse = await router.fetch(
      createRequest('https://app.example.com/inspect', callbackResponse),
    )

    assert.equal(callbackResponse.status, 400)
    assert.deepEqual(await callbackResponse.json(), {
      error: 'Nope',
    })
    assert.equal(await inspectResponse.json(), null)
  })

  it('rejects invalid OAuth state', async () => {
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

    router.get('/login/google', (context) => startExternalAuth(provider, context))
    router.get('/auth/google/callback', async (context) => {
      try {
        return Response.json(await finishExternalAuth(provider, context))
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error ? error.message : 'unknown',
          },
          { status: 400 },
        )
      }
    })

    let loginResponse = await router.fetch('https://app.example.com/login/google')
    let callbackResponse = await router.fetch(
      createRequest(
        'https://app.example.com/auth/google/callback?code=good-code&state=wrong',
        loginResponse,
      ),
    )

    assert.equal(callbackResponse.status, 400)
    assert.deepEqual(await callbackResponse.json(), {
      error: 'Invalid OAuth state.',
    })
  })
})
