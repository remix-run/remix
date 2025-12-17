import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'

describe('router', () => {
  it('responds to basic GET request', async () => {
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let html = await response.text()
    assert.ok(html.includes('Welcome to the Bookstore'))
  })

  it('returns 404 for unknown routes', async () => {
    let response = await router.fetch('https://remix.run/does-not-exist')

    assert.equal(response.status, 404)
  })
})
