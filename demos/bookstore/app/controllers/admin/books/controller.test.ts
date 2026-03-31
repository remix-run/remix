import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter, loginAsAdmin, requestWithSession } from '../../../../test/helpers.ts'

const router = createTestRouter()

describe('admin books handlers', () => {
  it('POST /admin/books creates new book when admin', async () => {
    let sessionId = await loginAsAdmin(router)

    // Create new book
    let createRequest = requestWithSession('https://remix.run/admin/books', sessionId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test description',
        price: '29.99',
        genre: 'test',
        isbn: '978-0000000000',
        publishedYear: '2024',
        inStock: 'true',
      }),
    })
    let response = await router.fetch(createRequest)

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/admin/books'))
  })
})
