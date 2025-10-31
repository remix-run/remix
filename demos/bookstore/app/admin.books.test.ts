import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { loginAsAdmin, requestWithSession } from '../test/helpers.ts'

describe('admin books handlers', () => {
  it('POST /admin/books creates new book when admin', async () => {
    let sessionCookie = await loginAsAdmin(router)

    // Create new book
    let createRequest = requestWithSession('http://localhost:3000/admin/books', sessionCookie, {
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
