import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assertContains, createTestRouter } from '../../test/helpers.ts'

let router = createTestRouter()

describe('home handler', () => {
  it('GET / returns home page', async () => {
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Welcome to the Bookstore')
    assertContains(html, 'Browse Books')
  })
})
