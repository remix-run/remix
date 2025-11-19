import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { loginAsCustomer, requestWithSession } from '../test/helpers.ts'

describe('admin handlers', () => {
  it('GET /admin redirects when not authenticated', async () => {
    let response = await router.fetch('https://remix.run/admin')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login?returnTo=%2Fadmin')
  })

  it('GET /admin returns 403 for non-admin users', async () => {
    let sessionId = await loginAsCustomer(router)

    // Try to access admin
    let request = requestWithSession('https://remix.run/admin', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 403)
  })
})
