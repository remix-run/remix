import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { assertContains } from '../test/helpers.ts'

describe('marketing handlers', () => {
  it('GET / returns home page', async () => {
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Welcome to the Bookstore')
    assertContains(html, 'Browse Books')
  })

  it('POST /contact returns success message', async () => {
    let response = await router.fetch('https://remix.run/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message',
      }).toString(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Thank you for your message')
  })
})
