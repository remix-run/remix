import * as assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { auth, Auth, requireAuth, sessionAuth } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { credentials } from './credentials.ts'
import { login } from './login.ts'
import { google } from './providers/google.ts'
import { createRequest } from './test-utils.ts'

describe('login()', () => {
  afterEach(() => {
    globalThis.fetch = fetch
  })

  it('redirects OAuth login requests to the provider authorization URL and stores a transaction', async () => {
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

    router.get('/login/google', login(provider))

    let response = await router.fetch('https://app.example.com/login/google?returnTo=/dashboard')
    let location = new URL(response.headers.get('Location')!)

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
  })

  it('authenticates with credentials login and writes session auth state', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let users = new Map([
      ['u1', { id: 'u1', email: 'mj@example.com' }],
    ])
    let provider = credentials({
      async parse(context) {
        let formData = await context.request.formData()
        return {
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
        }
      },
      verify(input) {
        if (input.email === 'mj@example.com' && input.password === 'secret') {
          return { id: 'u1' }
        }

        return null
      },
    })
    let router = createRouter({
      middleware: [
        sessionMiddleware(cookie, storage),
        auth({
          schemes: [
            sessionAuth({
              read(session) {
                return session.get('auth') as { userId: string; method: string } | null
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

    router.post(
      '/login',
      login(provider, {
        createSessionAuth(user) {
          return { userId: user.id, method: 'password' as const }
        },
        successRedirectTo: '/dashboard',
      }),
    )
    router.get('/dashboard', {
      middleware: [requireAuth()],
      action({ get }) {
        return Response.json(get(Auth))
      },
    })

    let response = await router.fetch(
      new Request('https://app.example.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'mj@example.com',
          password: 'secret',
        }),
      }),
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/dashboard')

    let dashboardResponse = await router.fetch(
      createRequest('https://app.example.com/dashboard', response),
    )

    assert.deepEqual(await dashboardResponse.json(), {
      ok: true,
      identity: { id: 'u1', email: 'mj@example.com' },
      scheme: 'session',
    })
  })

  it('redirects invalid credentials to failureRedirectTo', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let provider = credentials({
      async parse(context) {
        let formData = await context.request.formData()
        return {
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
        }
      },
      verify() {
        return null
      },
    })
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.post(
      '/login',
      login(provider, {
        createSessionAuth() {
          return { userId: 'u1', method: 'password' as const }
        },
        failureRedirectTo: '/login',
      }),
    )

    let response = await router.fetch(
      new Request('https://app.example.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'mj@example.com',
          password: 'wrong',
        }),
      }),
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('uses onSuccess for credentials providers after writing session state', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })
    let provider = credentials({
      async parse(context) {
        let formData = await context.request.formData()
        return {
          email: String(formData.get('email') ?? ''),
        }
      },
      verify(input) {
        return { id: 'u1', email: input.email }
      },
    })

    router.post(
      '/login',
      login(provider, {
        createSessionAuth(user) {
          return { userId: user.id, method: 'password' as const }
        },
        onSuccess(_user, _sessionAuth, context) {
          let session = context.get(Session)
          return Response.json({
            auth: session.get('auth'),
          })
        },
      }),
    )

    let response = await router.fetch(
      new Request('https://app.example.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'mj@example.com',
        }),
      }),
    )

    assert.deepEqual(await response.json(), {
      auth: { userId: 'u1', method: 'password' },
    })
  })
})
