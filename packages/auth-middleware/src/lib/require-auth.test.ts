import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter, type Middleware } from '@remix-run/fetch-router'

import { Auth, auth, type AuthState } from './auth.ts'
import { requireAuth } from './require-auth.ts'

describe('requireAuth middleware', () => {
  it('passes through when request is authenticated', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                return {
                  status: 'success',
                  identity: { id: 123 },
                }
              },
            },
          ],
        }),
        requireAuth(),
      ],
    })

    router.get('/', () => new Response('OK'))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
  })

  it('installs context.auth when auth state was set without a direct property', async () => {
    let loadAuth: Middleware<{ key: typeof Auth; value: AuthState<{ id: number }> }> = (
      context,
      next,
    ) => {
      context.set(Auth, {
        ok: true,
        identity: { id: 123 },
        method: 'custom',
      })
      return next()
    }
    let router = createRouter({
      middleware: [loadAuth, requireAuth<{ id: number }>()] as const,
    })

    router.get('/', (context) =>
      Response.json({
        direct: context.auth,
        keyed: context.get(Auth),
      }),
    )

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      direct: {
        ok: true,
        identity: { id: 123 },
        method: 'custom',
      },
      keyed: {
        ok: true,
        identity: { id: 123 },
        method: 'custom',
      },
    })
  })

  it('returns default 401 response when unauthenticated', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                return null
              },
            },
          ],
        }),
        requireAuth(),
      ],
    })

    router.get('/', () => new Response('OK'))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 401)
    assert.equal(await response.text(), 'Unauthorized')
  })

  it('supports a custom failure response callback', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                return {
                  status: 'failure',
                  code: 'invalid_credentials',
                  message: 'Bad token',
                }
              },
            },
          ],
        }),
        requireAuth({
          async onFailure(context, auth) {
            return Response.json(
              {
                path: context.url.pathname,
                error: auth.error?.message,
              },
              { status: 401 },
            )
          },
        }),
      ],
    })

    router.get('/private', () => new Response('OK'))

    let response = await router.fetch('https://remix.run/private')

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      path: '/private',
      error: 'Bad token',
    })
  })

  it('adds WWW-Authenticate header when challenge is present', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                return {
                  status: 'failure',
                  code: 'invalid_credentials',
                  message: 'Invalid token',
                  challenge: 'Bearer realm="api"',
                }
              },
            },
          ],
        }),
        requireAuth(),
      ],
    })

    router.get('/', () => new Response('OK'))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 401)
    assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer realm="api"')
  })

  it('does not overwrite existing WWW-Authenticate header', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            {
              name: 'bearer',
              authenticate() {
                return {
                  status: 'failure',
                  code: 'invalid_credentials',
                  message: 'Invalid token',
                  challenge: 'Bearer realm="api"',
                }
              },
            },
          ],
        }),
        requireAuth({
          onFailure() {
            return new Response('Forbidden', {
              status: 403,
              headers: {
                'WWW-Authenticate': 'Custom realm="admin"',
              },
            })
          },
        }),
      ],
    })

    router.get('/', () => new Response('OK'))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 403)
    assert.equal(response.headers.get('WWW-Authenticate'), 'Custom realm="admin"')
  })

  it('throws a clear error when auth middleware did not run first', async () => {
    let router = createRouter({
      middleware: [requireAuth()],
    })

    router.get('/', () => new Response('OK'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Auth state not found. Make sure auth() middleware runs before requireAuth().'))
  })
})
