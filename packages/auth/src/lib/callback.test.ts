import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { auth, Auth, requireAuth, sessionAuth } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { callback } from './callback.ts'
import { login } from './login.ts'
import { google } from './providers/google.ts'
import { createRequest, mockFetch } from './test-utils.ts'

describe('callback()', () => {
  it('completes a Google callback, preserves returnTo, and authenticates via sessionAuth()', async () => {
    let restoreFetch = mockFetch(async (input, init) => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

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
      let users = new Map([
        ['u1', { id: 'u1', email: 'mj@example.com' }],
      ])
      let provider = google({
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'https://app.example.com/auth/google/callback',
      })
      let router = createRouter({
        middleware: [
          sessionMiddleware(cookie, storage),
          auth({
            schemes: [
              sessionAuth({
                read(session) {
                  return session.get('auth') as { userId: string } | null
                },
                verify(value) {
                  return users.get(value.userId) ?? null
                },
              }),
            ],
          }),
        ],
      })

      router.get('/login/google', login(provider))
      router.get(
        '/auth/google/callback',
        callback(provider, {
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
        'https://app.example.com/login/google?returnTo=/dashboard',
      )
      let state = new URL(loginResponse.headers.get('Location')!).searchParams.get('state')
      let callbackResponse = await router.fetch(
        createRequest(
          `https://app.example.com/auth/google/callback?code=good-code&state=${state}`,
          loginResponse,
        ),
      )

      assert.equal(callbackResponse.status, 302)
      assert.equal(callbackResponse.headers.get('Location'), '/dashboard')

      let dashboardResponse = await router.fetch(
        createRequest('https://app.example.com/dashboard', callbackResponse),
      )

      assert.deepEqual(await dashboardResponse.json(), {
        ok: true,
        identity: { id: 'u1', email: 'mj@example.com' },
        scheme: 'session',
      })
    } finally {
      restoreFetch()
    }
  })

  it('uses onFailure for callback errors', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = google({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'https://app.example.com/auth/google/callback',
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get(
      '/auth/google/callback',
      callback(provider, {
        writeSession(session, result) {
          session.set('auth', { userId: result.profile.sub })
        },
        onFailure(error) {
          return Response.json(
            {
              error: error instanceof Error ? error.message : 'unknown',
            },
            { status: 400 },
          )
        },
      }),
    )

    let response = await router.fetch(
      'https://app.example.com/auth/google/callback?code=bad&state=wrong',
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'Missing OAuth transaction for "google".',
    })
  })
})
