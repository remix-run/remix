import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession } from '../test/helpers.ts'

describe('admin handlers', () => {
  it('GET /admin redirects when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/admin')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('GET /admin returns 403 for non-admin users', async () => {
    // Log in as regular customer
    let loginResponse = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(loginResponse)
    assert.ok(sessionId)

    // Try to access admin
    let request = requestWithSession('http://localhost:3000/admin', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 403)
  })
})
