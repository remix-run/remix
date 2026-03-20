import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { createSession, Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { auth } from '../auth.ts'
import { requireAuth } from '../require-auth.ts'
import { Auth } from '../auth.ts'
import { createSessionAuthScheme } from './session.ts'

describe('createSessionAuthScheme scheme', () => {
  it('throws when Session is not available in request context', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            createSessionAuthScheme({
              read() {
                return null
              },
              verify() {
                return { id: 'u1' }
              },
            }),
          ],
        }),
      ],
    })

    router.get('/', () => new Response('OK'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Session not found. Make sure session() middleware runs before createSessionAuthScheme().'))
  })

  it('skips when read() returns null', async () => {
    let router = createRouter({
      middleware: [
        (context, next) => {
          context.set(Session, createSession())
          return next()
        },
        auth({
          schemes: [
            createSessionAuthScheme({
              read() {
                return null
              },
              verify() {
                return { id: 'u1' }
              },
            }),
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.get(Auth)))

    let response = await router.fetch('https://remix.run/')

    assert.deepEqual(await response.json(), {
      ok: false,
    })
  })

  it('authenticates when verify() returns an identity', async () => {
    let router = createRouter({
      middleware: [
        (context, next) => {
          let session = createSession()
          session.set('auth', { userId: 'u1' })
          context.set(Session, session)
          return next()
        },
        auth({
          schemes: [
            createSessionAuthScheme({
              read(session) {
                return session.get('auth')
              },
              verify(value: { userId: string }) {
                return { id: value.userId, role: 'admin' }
              },
            }),
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.get(Auth)))

    let response = await router.fetch('https://remix.run/')

    assert.deepEqual(await response.json(), {
      ok: true,
      identity: { id: 'u1', role: 'admin' },
      method: 'session',
    })
  })

  it('fails and invalidates when verify() returns null', async () => {
    let invalidated = false

    let router = createRouter({
      middleware: [
        (context, next) => {
          let session = createSession()
          session.set('auth', { userId: 'u1' })
          context.set(Session, session)
          return next()
        },
        auth({
          schemes: [
            createSessionAuthScheme({
              read(session) {
                return session.get('auth')
              },
              verify() {
                return null
              },
              invalidate(session) {
                invalidated = true
                session.unset('auth')
              },
              message: 'Session is no longer valid',
            }),
          ],
        }),
      ],
    })

    router.get('/', (context) => {
      let session = context.get(Session)
      return Response.json({
        auth: context.get(Auth),
        createSessionAuthScheme: session.get('auth') ?? null,
      })
    })

    let response = await router.fetch('https://remix.run/')

    assert.deepEqual(await response.json(), {
      auth: {
        ok: false,
        error: {
          method: 'session',
          code: 'invalid_credentials',
          message: 'Session is no longer valid',
        },
      },
      createSessionAuthScheme: null,
    })
    assert.equal(invalidated, true)
  })

  it('uses a custom scheme name', async () => {
    let router = createRouter({
      middleware: [
        (context, next) => {
          let session = createSession()
          session.set('member', { userId: 'u1' })
          context.set(Session, session)
          return next()
        },
        auth({
          schemes: [
            createSessionAuthScheme({
              name: 'member-session',
              read(session) {
                return session.get('member')
              },
              verify(value: { userId: string }) {
                return { id: value.userId }
              },
            }),
          ],
        }),
      ],
    })

    router.get('/', (context) => Response.json(context.get(Auth)))

    let response = await router.fetch('https://remix.run/')

    assert.deepEqual(await response.json(), {
      ok: true,
      identity: { id: 'u1' },
      method: 'member-session',
    })
  })

  it('invalidates stale session auth before requireAuth() returns 401', async () => {
    let invalidated = false
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let router = createRouter({
      middleware: [
        sessionMiddleware(cookie, storage),
        auth({
          schemes: [
            createSessionAuthScheme({
              read(session) {
                return session.get('auth')
              },
              verify() {
                return null
              },
              invalidate(session) {
                invalidated = true
                session.unset('auth')
              },
              message: 'Session expired',
            }),
          ],
        }),
      ],
    })

    router.get('/seed', ({ get }) => {
      let session = get(Session)
      session.set('auth', { userId: 'u1' })
      return new Response('Seeded')
    })

    router.get('/protected', {
      middleware: [requireAuth()],
      action: () => new Response('OK'),
    })

    router.get('/inspect', ({ get }) =>
      Response.json({
        auth: get(Auth),
        createSessionAuthScheme: get(Session).get('auth') ?? null,
      }),
    )

    let seedResponse = await router.fetch('https://remix.run/seed')
    let protectedResponse = await router.fetch(
      createRequest('https://remix.run/protected', seedResponse),
    )

    assert.equal(protectedResponse.status, 401)
    assert.equal(await protectedResponse.text(), 'Unauthorized')
    assert.equal(invalidated, true)

    let inspectResponse = await router.fetch(
      createRequest('https://remix.run/inspect', protectedResponse),
    )

    assert.deepEqual(await inspectResponse.json(), {
      auth: {
        ok: false,
      },
      createSessionAuthScheme: null,
    })
  })
})

function createRequest(url: string, fromResponse?: Response): Request {
  let headers = new Headers()

  if (fromResponse != null) {
    let cookieValues = fromResponse.headers.getSetCookie().map((value) => value.split(';', 1)[0])

    if (cookieValues.length > 0) {
      headers.set('Cookie', cookieValues.join('; '))
    }
  }

  return new Request(url, { headers })
}
