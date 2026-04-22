import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { completeAuth } from './complete-auth.ts'
import { createRequest } from './test-utils.ts'

describe('completeAuth()', () => {
  it('rotates the session id and returns the session for auth writes', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createMemorySessionStorage()
    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.get('/prepare', ({ get }) => {
      let session = get(Session)
      session.set('prepared', true)
      return Response.json({
        sessionId: session.id,
      })
    })
    router.post('/login', (context) => {
      let currentSession = context.get(Session)
      let beforeId = currentSession.id
      let session = completeAuth(context)

      session.set('auth', { userId: 'u1' })

      return Response.json({
        beforeId,
        afterId: session.id,
        prepared: session.get('prepared'),
        auth: session.get('auth'),
      })
    })

    let prepareResponse = await router.fetch('https://app.example.com/prepare')
    let response = await router.fetch(
      createRequest('https://app.example.com/login', prepareResponse, {
        method: 'POST',
      }),
    )

    let body = await response.json()

    assert.notEqual(body.beforeId, body.afterId)
    assert.equal(body.prepared, true)
    assert.deepEqual(body.auth, {
      userId: 'u1',
    })
  })
})
