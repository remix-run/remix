import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'
import { createSession, Session } from '@remix-run/session'

import { auth } from '../auth.ts'
import { Auth } from '../types.ts'
import { sessionAuth } from './session.ts'

describe('sessionAuth scheme', () => {
  it('throws when Session is not available in request context', async () => {
    let router = createRouter({
      middleware: [
        auth({
          schemes: [
            sessionAuth({
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

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run/')
      },
      new Error('Session not found. Make sure session() middleware runs before sessionAuth().'),
    )
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
            sessionAuth({
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
            sessionAuth({
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
      scheme: 'session',
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
            sessionAuth({
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
        sessionAuth: session.get('auth') ?? null,
      })
    })

    let response = await router.fetch('https://remix.run/')

    assert.deepEqual(await response.json(), {
      auth: {
        ok: false,
        error: {
          scheme: 'session',
          code: 'invalid_credentials',
          message: 'Session is no longer valid',
        },
      },
      sessionAuth: null,
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
            sessionAuth({
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
      scheme: 'member-session',
    })
  })
})
